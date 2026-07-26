package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func handleBackupsExtended(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		files := listBackupFiles()
		data, _ := json.Marshal(map[string]any{"backups": files})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	action := strVal(body["action"])
	if action == "" {
		action = "create"
	}
	switch action {
	case "create":
		handleBackupCreate(w, body)
	case "restore":
		handleBackupRestore(w, body)
	case "verify":
		handleBackupVerify(w, body)
	case "offsite":
		handleBackupOffsite(w, body)
	case "restic_init":
		handleResticInit(w, body)
	case "restic_forget":
		handleResticForget(w, body)
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unsupported action"})
	}
}

func handleBackupCreate(w http.ResponseWriter, body map[string]any) {
	btype := strVal(body["type"])
	target := strVal(body["target"])
	if target == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "target required"})
		return
	}
	_ = os.MkdirAll(backupDir, 0o755)
	ts := time.Now().UTC().Format("20060102-150405")
	safeTarget := strings.NewReplacer("/", "_", " ", "_").Replace(target)
	var filename string
	var err error

	switch btype {
	case "files":
		absTarget, pathErr := safeFilePath(target)
		if pathErr != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: pathErr.Error()})
			return
		}
		filename = fmt.Sprintf("files-%s-%s.tar.gz", safeTarget, ts)
		dest := filepath.Join(backupDir, filename)
		_, err = runArgv([]string{"tar", "-czf", dest, "-C", absTarget, "."}, "")
	case "db":
		filename = fmt.Sprintf("db-%s-%s.sql.gz", safeTarget, ts)
		dest := filepath.Join(backupDir, filename)
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("mysqldump %s | gzip > %s", shellQuote(target), shellQuote(dest))}, "")
	case "full":
		absTarget, pathErr := safeFilePath(target)
		if pathErr != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: pathErr.Error()})
			return
		}
		filesName := fmt.Sprintf("full-%s-%s-files.tar.gz", safeTarget, ts)
		dbName := fmt.Sprintf("full-%s-%s-db.sql.gz", safeTarget, ts)
		filesDest := filepath.Join(backupDir, filesName)
		dbDest := filepath.Join(backupDir, dbName)
		_, err = runArgv([]string{"tar", "-czf", filesDest, "-C", absTarget, "."}, "")
		if err == nil {
			dbTarget := filepath.Base(strings.TrimSuffix(target, "/"))
			if dbTarget == "" || dbTarget == "." {
				dbTarget = safeTarget
			}
			_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("mysqldump %s | gzip > %s", shellQuote(dbTarget), shellQuote(dbDest))}, "")
		}
		if err == nil {
			filename = filesName + "," + dbName
		}
	case "wordpress":
		wpPath := strVal(body["wp_path"])
		wpDB := strVal(body["wp_db"])
		if wpPath == "" || wpDB == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "wp_path and wp_db required for wordpress backup"})
			return
		}
		absWP, pathErr := safeFilePath(wpPath)
		if pathErr != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: pathErr.Error()})
			return
		}
		filesName := fmt.Sprintf("wordpress-%s-%s-files.tar.gz", safeTarget, ts)
		dbName := fmt.Sprintf("wordpress-%s-%s-db.sql.gz", safeTarget, ts)
		filesDest := filepath.Join(backupDir, filesName)
		dbDest := filepath.Join(backupDir, dbName)
		_, err = runArgv([]string{"tar", "-czf", filesDest, "-C", absWP, "."}, "")
		if err == nil {
			_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("mysqldump %s | gzip > %s", shellQuote(wpDB), shellQuote(dbDest))}, "")
		}
		if err == nil {
			filename = filesName + "," + dbName
			btype = "wordpress"
		}
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "type must be files, db, full, or wordpress"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	size := backupFileSize(filename)
	checksum := ""
	if !strings.Contains(filename, ",") {
		checksum = fileChecksum(filepath.Join(backupDir, filename))
	}
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	if repo == "" {
		repo = envOr("WEBINO_RESTIC_REPO", "")
	}
	if password == "" {
		password = envOr("WEBINO_RESTIC_PASSWORD", "")
	}
	snapshotID := ""
	if repo != "" && password != "" {
		snapshotID, _ = resticBackup(repo, password, backupDir)
	}
	data, _ := json.Marshal(map[string]any{
		"filename": filename, "size": size, "type": btype, "target": target,
		"checksum": checksum, "snapshot_id": snapshotID,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleBackupRestore(w http.ResponseWriter, body map[string]any) {
	filename := strVal(body["filename"])
	target := strVal(body["target"])
	btype := strVal(body["type"])
	snapshotID := strVal(body["snapshot_id"])
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	if repo == "" {
		repo = envOr("WEBINO_RESTIC_REPO", "")
	}
	if password == "" {
		password = envOr("WEBINO_RESTIC_PASSWORD", "")
	}
	if snapshotID != "" && repo != "" {
		absTarget, err := safeFilePath(target)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		_ = os.MkdirAll(absTarget, 0o755)
		_, err = runArgvEnv([]string{"restic", "-r", repo, "restore", snapshotID, "--target", absTarget}, map[string]string{
			"RESTIC_PASSWORD": password,
		})
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"restored": "true", "target": absTarget})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if filename == "" || target == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "filename and target required"})
		return
	}
	path := filepath.Join(backupDir, filepath.Base(filename))
	var err error
	switch btype {
	case "db":
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("gunzip -c %s | mysql %s", shellQuote(path), shellQuote(target))}, "")
	case "files", "full":
		absTarget, pathErr := safeFilePath(target)
		if pathErr != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: pathErr.Error()})
			return
		}
		_ = os.MkdirAll(absTarget, 0o755)
		_, err = runArgv([]string{"tar", "-xzf", path, "-C", absTarget}, "")
	default:
		absTarget, pathErr := safeFilePath(target)
		if pathErr != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: pathErr.Error()})
			return
		}
		_ = os.MkdirAll(absTarget, 0o755)
		_, err = runArgv([]string{"tar", "-xzf", path, "-C", absTarget}, "")
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"restored": "true", "filename": filename})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleBackupVerify(w http.ResponseWriter, body map[string]any) {
	filename := strVal(body["filename"])
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	if repo == "" {
		repo = envOr("WEBINO_RESTIC_REPO", "")
	}
	if password == "" {
		password = envOr("WEBINO_RESTIC_PASSWORD", "")
	}
	if repo != "" && password != "" {
		out, err := runArgvEnv([]string{"restic", "-r", repo, "check"}, map[string]string{
			"RESTIC_PASSWORD": password,
		})
		ok := err == nil
		data, _ := json.Marshal(map[string]any{"ok": ok, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: ok, Data: data})
		return
	}
	if filename == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "filename required"})
		return
	}
	path := filepath.Join(backupDir, filepath.Base(filename))
	checksum := fileChecksum(path)
	ok := checksum != ""
	data, _ := json.Marshal(map[string]any{"ok": ok, "checksum": checksum})
	writeJSON(w, http.StatusOK, envelope{OK: ok, Data: data})
}

func handleBackupOffsite(w http.ResponseWriter, body map[string]any) {
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	path := strVal(body["path"])
	if repo == "" || password == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "restic_repo and restic_password required"})
		return
	}
	if path == "" {
		path = backupDir
	}
	snapshotID, err := resticBackup(repo, password, path)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"snapshot_id": snapshotID})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleResticInit(w http.ResponseWriter, body map[string]any) {
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	if repo == "" || password == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "restic_repo and restic_password required"})
		return
	}
	out, err := runArgvEnv([]string{"restic", "-r", repo, "init"}, map[string]string{
		"RESTIC_PASSWORD": password,
	})
	if err != nil && !strings.Contains(out, "already exists") {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"repo": repo, "initialized": "true"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleResticForget(w http.ResponseWriter, body map[string]any) {
	repo := strVal(body["restic_repo"])
	password := strVal(body["restic_password"])
	keepDays := strVal(body["keep_days"])
	if keepDays == "" {
		keepDays = "7"
	}
	if repo == "" || password == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "restic_repo and restic_password required"})
		return
	}
	_, err := runArgvEnv([]string{
		"restic", "-r", repo, "forget", "--keep-within", keepDays + "d", "--prune",
	}, map[string]string{"RESTIC_PASSWORD": password})
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"pruned": "true"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func resticBackup(repo, password, path string) (string, error) {
	out, err := runArgvEnv([]string{"restic", "-r", repo, "backup", path}, map[string]string{
		"RESTIC_PASSWORD": password,
	})
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(out, "\n") {
		if strings.Contains(line, "snapshot") {
			fields := strings.Fields(line)
			if len(fields) > 0 {
				return fields[len(fields)-1], nil
			}
		}
	}
	return strings.TrimSpace(out), nil
}

func backupFileSize(filename string) int64 {
	var size int64
	if strings.Contains(filename, ",") {
		for _, part := range strings.Split(filename, ",") {
			if st, err := os.Stat(filepath.Join(backupDir, part)); err == nil {
				size += st.Size()
			}
		}
	} else if st, err := os.Stat(filepath.Join(backupDir, filename)); err == nil {
		size = st.Size()
	}
	return size
}

func fileChecksum(path string) string {
	out, err := runArgv([]string{"sha256sum", path}, "")
	if err != nil {
		return ""
	}
	fields := strings.Fields(out)
	if len(fields) > 0 {
		return fields[0]
	}
	return ""
}

func runArgvEnv(argv []string, extraEnv map[string]string) (string, error) {
	unlock := acquireExecLock(execLockKey(argv))
	defer unlock()
	cmd := exec.Command(argv[0], argv[1:]...)
	cmd.Env = os.Environ()
	for k, v := range extraEnv {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return strings.TrimSpace(string(out)), nil
}
