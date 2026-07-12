package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var allowedPhpExtensions = map[string]bool{
	"bcmath": true, "curl": true, "gd": true, "intl": true, "mbstring": true,
	"mysql": true, "opcache": true, "pgsql": true, "readline": true,
	"soap": true, "sqlite3": true, "xml": true, "zip": true,
}

func handlePhpIni(w http.ResponseWriter, r *http.Request) {
	version := strings.TrimSpace(r.URL.Query().Get("version"))
	if version == "" {
		version = "8.3"
	}
	if err := validatePhpVersion(version); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	iniPath, err := jailPathUnder(filepath.Join("/etc/php", version, "fpm"), "php.ini")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}

	if r.Method == http.MethodGet {
		content, readErr := os.ReadFile(iniPath)
		if readErr != nil && !os.IsNotExist(readErr) {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: readErr.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{
			"version": version,
			"path":    iniPath,
			"content": string(content),
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Version string `json:"version"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if body.Version != "" {
		version = body.Version
	}
	if err := validatePhpVersion(version); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	iniPath, err = jailPathUnder(filepath.Join("/etc/php", version, "fpm"), "php.ini")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := os.MkdirAll(filepath.Dir(iniPath), 0o755); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := os.WriteFile(iniPath, []byte(body.Content), 0o644); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"systemctl", "reload", "php" + version + "-fpm"}, "")
	data, _ := json.Marshal(map[string]string{"version": version, "path": iniPath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handlePhpExtensions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Version   string `json:"version"`
		Extension string `json:"extension"`
		Action    string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Extension == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "extension required"})
		return
	}
	version := body.Version
	if version == "" {
		version = "8.3"
	}
	if err := validatePhpVersion(version); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	ext := strings.ToLower(strings.TrimSpace(body.Extension))
	if !allowedPhpExtensions[ext] {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "extension not allowed"})
		return
	}
	cmd := "phpenmod"
	if body.Action == "disable" {
		cmd = "phpdismod"
	}
	out, err := runArgv([]string{cmd, "-v", version, ext}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"systemctl", "reload", "php" + version + "-fpm"}, "")
	data, _ := json.Marshal(map[string]string{
		"extension": ext,
		"version":   version,
		"action":    body.Action,
		"output":    out,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func listPhpPools(version string) []map[string]any {
	versions := []string{"8.1", "8.2", "8.3", "8.4"}
	if version != "" {
		versions = []string{version}
	}
	pools := make([]map[string]any, 0)
	for _, v := range versions {
		poolDir := filepath.Join("/etc/php", v, "fpm", "pool.d")
		entries, err := os.ReadDir(poolDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".conf") {
				continue
			}
			name := strings.TrimSuffix(e.Name(), ".conf")
			path := filepath.Join(poolDir, e.Name())
			content, _ := os.ReadFile(path)
			pools = append(pools, map[string]any{
				"name":         name,
				"php_version":  v,
				"path":         path,
				"content":      string(content),
			})
		}
	}
	return pools
}
