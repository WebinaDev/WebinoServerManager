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

var hostingHomes string

func initHostingEnv() {
	hostingHomes = envOr("WEBINO_HOSTING_HOMES", "/var/www")
}

func handleHostingSuspend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "username required"})
		return
	}
	if err := setHostingSuspended(body.Username, true); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"username": body.Username, "status": "suspended"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleHostingUnsuspend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "username required"})
		return
	}
	if err := setHostingSuspended(body.Username, false); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"username": body.Username, "status": "active"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleHostingUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	account := r.URL.Query().Get("account")
	if account == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "account required"})
		return
	}
	disk, inodes, err := hostingUsageForAccount(account)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]any{"disk_mb": disk, "inodes": inodes})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func hostingHomePath(username string) string {
	safe := strings.ReplaceAll(username, "/", "")
	safe = strings.ReplaceAll(safe, "..", "")
	return filepath.Join(hostingHomes, safe)
}

func setHostingSuspended(username string, suspend bool) error {
	home := hostingHomePath(username)
	if suspend {
		if err := disableNginxVhostsForUser(username); err != nil {
			return err
		}
		_, _ = runArgv([]string{"pure-pw", "usermod", username, "-r"}, "")
		_, _ = runArgv([]string{"sh", "-c", fmt.Sprintf("crontab -u %s -l 2>/dev/null | sed 's/^/#SUSPENDED#/' | crontab -u %s -", shellQuote(username), shellQuote(username))}, "")
		_ = os.WriteFile(filepath.Join(home, ".webino_suspended"), []byte("1"), 0o644)
		return nil
	}
	if err := enableNginxVhostsForUser(username); err != nil {
		return err
	}
	_, _ = runArgv([]string{"pure-pw", "usermod", username, "-r", home}, "")
	_, _ = runArgv([]string{"sh", "-c", fmt.Sprintf("crontab -u %s -l 2>/dev/null | sed 's/^#SUSPENDED#//' | crontab -u %s -", shellQuote(username), shellQuote(username))}, "")
	_ = os.Remove(filepath.Join(home, ".webino_suspended"))
	return nil
}

func disableNginxVhostsForUser(username string) error {
	prefix := username + "_"
	entries, err := os.ReadDir(nginxEnabled)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), prefix) || strings.HasPrefix(e.Name(), username+".") {
			_ = os.Remove(filepath.Join(nginxEnabled, e.Name()))
		}
	}
	_, err = reloadNginx()
	return err
}

func enableNginxVhostsForUser(username string) error {
	prefix := username + "_"
	entries, err := os.ReadDir(nginxSitesDir)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".conf") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".conf")
		if strings.HasPrefix(name, prefix) || strings.HasPrefix(name, username+".") {
			confPath := filepath.Join(nginxSitesDir, e.Name())
			enabledPath := filepath.Join(nginxEnabled, e.Name())
			_ = os.Remove(enabledPath)
			_ = os.Symlink(confPath, enabledPath)
		}
	}
	_, err = reloadNginx()
	return err
}

func hostingUsageForAccount(username string) (int, int, error) {
	home := hostingHomePath(username)
	if _, err := os.Stat(home); os.IsNotExist(err) {
		return 0, 0, nil
	}
	out, err := runArgv([]string{"du", "-sm", home}, "")
	disk := 0
	if err == nil && out != "" {
		parts := strings.Fields(out)
		if len(parts) > 0 {
			disk, _ = strconv.Atoi(parts[0])
		}
	}
	inodeOut, err := runArgv([]string{"sh", "-c", fmt.Sprintf("find %s 2>/dev/null | wc -l", shellQuote(home))}, "")
	inodes := 0
	if err == nil {
		inodes, _ = strconv.Atoi(strings.TrimSpace(inodeOut))
	}
	return disk, inodes, nil
}

func parseDuOutput(out string) int {
	parts := strings.Fields(strings.TrimSpace(out))
	if len(parts) == 0 {
		return 0
	}
	n, _ := strconv.Atoi(parts[0])
	return n
}
