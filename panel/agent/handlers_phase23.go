package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func handleSslCertificates(w http.ResponseWriter, r *http.Request) {
	handleSslCertificatesExtended(w, r)
}

func handleFtpAccounts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		accounts := listFtpAccounts()
		data, _ := json.Marshal(map[string]any{"accounts": accounts})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		HomeDir  string `json:"home_dir"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "username required"})
		return
	}
	if body.Action == "delete" {
		if err := validateSafeName(body.Username, 32); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		out, err := runArgv([]string{"pure-pw", "userdel", body.Username, "-m"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "username": body.Username})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if err := validateSafeName(body.Username, 32); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	homeDir := body.HomeDir
	if homeDir == "" {
		homeDir = filepath.Join("sites", body.Username)
	}
	absHome, err := safeFilePath(homeDir)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	_ = os.MkdirAll(absHome, 0o755)
	if err := ensureFtpSystemUser(body.Username, absHome); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	argv := []string{
		"pure-pw", "useradd", body.Username,
		"-u", body.Username,
		"-d", absHome,
		"-m",
	}
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := setPurePwPassword(body.Username, body.Password); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"pure-pw", "mkdb"}, "")
	data, _ := json.Marshal(map[string]string{"output": out, "username": body.Username})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handlePhpPools(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		version := strings.TrimSpace(r.URL.Query().Get("version"))
		pools := listPhpPools(version)
		data, _ := json.Marshal(map[string]any{"pools": pools})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Name       string         `json:"name"`
		Domain     string         `json:"domain"`
		PHPVersion string         `json:"php_version"`
		Settings   map[string]any `json:"settings"`
		Action     string         `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	if err := validateSafeName(body.Name, 64); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	if body.Domain != "" {
		if err := validateDomain(body.Domain); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
	}
	if err := validatePhpPoolSettings(body.Settings); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	version := body.PHPVersion
	if version == "" {
		version = "8.3"
	}
	if err := validatePhpVersion(version); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	poolDir := filepath.Join("/etc/php", version, "fpm", "pool.d")
	confPath, err := jailPathUnder(poolDir, body.Name+".conf")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	if body.Action == "delete" {
		_ = os.Remove(confPath)
		_, _ = runArgv([]string{"systemctl", "reload", "php" + version + "-fpm"}, "")
		data, _ := json.Marshal(map[string]string{"name": body.Name, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	_ = os.MkdirAll(poolDir, 0o755)
	conf := buildPhpPoolConf(body.Name, version, body.Domain, body.Settings)
	if err := os.WriteFile(confPath, []byte(conf), 0o644); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"systemctl", "reload", "php" + version + "-fpm"}, "")
	data, _ := json.Marshal(map[string]string{"name": body.Name, "path": confPath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action  string `json:"action"`
		Path    string `json:"path"`
		Dest    string `json:"dest"`
		Content string `json:"content"`
		Mode    string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	abs, err := safeFilePath(body.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	switch body.Action {
	case "list":
		entries, err := listDir(abs)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"entries": entries})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "read":
		b, err := os.ReadFile(abs)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"content": string(b)})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "write":
		if err := os.WriteFile(abs, []byte(body.Content), 0o644); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"path": body.Path})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "mkdir":
		if err := os.MkdirAll(abs, 0o755); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"path": body.Path})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "delete":
		if err := os.RemoveAll(abs); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"path": body.Path})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "rename":
		if body.Dest == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "dest required"})
			return
		}
		destAbs, err := safeFilePath(body.Dest)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if err := os.Rename(abs, destAbs); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"path": body.Path, "dest": body.Dest})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "chmod":
		if body.Mode == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "mode required"})
			return
		}
		mode, err := parseFileMode(body.Mode)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if err := os.Chmod(abs, mode); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"path": body.Path, "mode": body.Mode})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func handleCron(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(r.URL.Query().Get("username"))
	if r.Method == http.MethodGet {
		lines := listCrontabLines(username)
		data, _ := json.Marshal(map[string]any{"entries": lines, "username": username})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Schedule string `json:"schedule"`
		Command  string `json:"command"`
		Action   string `json:"action"`
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Command == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "command required"})
		return
	}
	if body.Username != "" {
		username = body.Username
	}
	if username != "" {
		if err := validateSafeName(username, 32); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
	}
	if err := validateCronCommand(body.Command); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	line := strings.TrimSpace(body.Schedule) + " " + strings.TrimSpace(body.Command)
	existing, _ := runCrontab(username, "-l")
	lines := strings.Split(strings.TrimSpace(existing), "\n")
	if body.Action == "delete" {
		filtered := make([]string, 0, len(lines))
		for _, l := range lines {
			if strings.TrimSpace(l) != line && l != "" {
				filtered = append(filtered, l)
			}
		}
		newCrontab := strings.Join(filtered, "\n")
		if newCrontab != "" {
			newCrontab += "\n"
		}
		if err := writeCrontab(username, newCrontab); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"removed": line, "username": username})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Schedule == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "schedule required"})
		return
	}
	if err := validateCronSchedule(body.Schedule); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	newCrontab := strings.TrimSpace(existing)
	if newCrontab != "" {
		newCrontab += "\n"
	}
	newCrontab += line + "\n"
	if err := writeCrontab(username, newCrontab); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"line": line, "username": username})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func safeFilePath(p string) (string, error) {
	clean := filepath.Clean("/" + strings.TrimPrefix(p, "/"))
	abs := filepath.Join(filesRoot, clean)

	rootReal, err := resolveJailRoot(filesRoot)
	if err != nil {
		return "", err
	}

	targetReal, err := resolvePathUnderRoot(abs, filesRoot)
	if err != nil {
		return "", err
	}

	if targetReal != rootReal && !strings.HasPrefix(targetReal, rootReal+string(os.PathSeparator)) {
		return "", fmt.Errorf("path outside jail")
	}
	return targetReal, nil
}

func resolveJailRoot(root string) (string, error) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	real, err := filepath.EvalSymlinks(rootAbs)
	if err != nil {
		if os.IsNotExist(err) {
			return rootAbs, nil
		}
		return "", err
	}
	return real, nil
}

func resolvePathUnderRoot(path, root string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	real, err := filepath.EvalSymlinks(abs)
	if err == nil {
		return real, nil
	}
	if !os.IsNotExist(err) {
		return "", err
	}
	parent := filepath.Dir(abs)
	parentReal, err := filepath.EvalSymlinks(parent)
	if err != nil {
		if os.IsNotExist(err) {
			return abs, nil
		}
		return "", err
	}
	return filepath.Join(parentReal, filepath.Base(abs)), nil
}

func parseFileMode(mode string) (os.FileMode, error) {
	mode = strings.TrimSpace(mode)
	if mode == "" {
		return 0, fmt.Errorf("empty mode")
	}
	if strings.HasPrefix(mode, "0") {
		mode = mode[1:]
	}
	n, err := strconv.ParseUint(mode, 8, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid mode")
	}
	return os.FileMode(n), nil
}

func listDir(abs string) ([]map[string]any, error) {
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		info, _ := e.Info()
		size := int64(0)
		if info != nil {
			size = info.Size()
		}
		modeStr := ""
		if info != nil {
			modeStr = fmt.Sprintf("%04o", info.Mode().Perm())
		}
		out = append(out, map[string]any{
			"name":   e.Name(),
			"is_dir": e.IsDir(),
			"size":   size,
			"mode":   modeStr,
		})
	}
	return out, nil
}

func writeCrontab(username, content string) error {
	tmp := filepath.Join(os.TempDir(), "webino-crontab")
	if err := os.WriteFile(tmp, []byte(content), 0o600); err != nil {
		return err
	}
	_, err := runCrontab(username, tmp)
	_ = os.Remove(tmp)
	return err
}

func crontabArgv(username string, args ...string) []string {
	argv := []string{"crontab"}
	if username != "" {
		argv = append(argv, "-u", username)
	}
	return append(argv, args...)
}

func runCrontab(username string, args ...string) (string, error) {
	argv := crontabArgv(username, args...)
	return runArgv(argv, "")
}
