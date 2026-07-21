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
	bw := hostingBandwidthForAccount(account)
	data, _ := json.Marshal(map[string]any{"disk_mb": disk, "inodes": inodes, "bandwidth_mb": bw})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleHostingProvision(w http.ResponseWriter, r *http.Request) {
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
	if err := provisionHostingAccount(body.Username); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"username": body.Username, "home": hostingHomePath(body.Username)})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleHostingDeprovision(w http.ResponseWriter, r *http.Request) {
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
	if err := deprovisionHostingAccount(body.Username); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"username": body.Username, "status": "deleted"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func provisionHostingAccount(username string) error {
	home := hostingHomePath(username)
	if _, err := os.Stat(home); err == nil {
		return fmt.Errorf("home already exists")
	}
	if out, err := runArgv([]string{"id", "-u", username}, ""); err == nil && strings.TrimSpace(out) != "" {
		return fmt.Errorf("unix user already exists")
	}
	if _, err := runArgv([]string{"useradd", "-m", "-d", home, "-s", "/usr/sbin/nologin", username}, ""); err != nil {
		return fmt.Errorf("useradd: %w", err)
	}
	public := filepath.Join(home, "public_html")
	_ = os.MkdirAll(public, 0o755)
	_ = os.Chown(public, uidFor(username), gidFor(username))
	_ = os.WriteFile(filepath.Join(home, ".webino_account"), []byte(username+"\n"), 0o644)
	return nil
}

func deprovisionHostingAccount(username string) error {
	_ = setHostingSuspended(username, true)
	home := hostingHomePath(username)
	_, _ = runArgv([]string{"userdel", "-r", username}, "")
	_ = os.RemoveAll(home)
	return nil
}

func uidFor(username string) int {
	out, err := runArgv([]string{"id", "-u", username}, "")
	if err != nil {
		return 0
	}
	n, _ := strconv.Atoi(strings.TrimSpace(out))
	return n
}

func gidFor(username string) int {
	out, err := runArgv([]string{"id", "-g", username}, "")
	if err != nil {
		return 0
	}
	n, _ := strconv.Atoi(strings.TrimSpace(out))
	return n
}

func hostingBandwidthForAccount(username string) int {
	home := hostingHomePath(username)
	raw, err := os.ReadFile(filepath.Join(home, ".webino_bandwidth_mb"))
	if err != nil {
		return 0
	}
	n, _ := strconv.Atoi(strings.TrimSpace(string(raw)))
	return n
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
		// Soft-lock mail: marker for reconcile/mail tooling; doveadm lock when available.
		_ = os.WriteFile(filepath.Join(home, ".webino_mail_locked"), []byte("1"), 0o644)
		_, _ = runArgv([]string{"sh", "-c", fmt.Sprintf("doveadm auth cache flush 2>/dev/null; true")}, "")
		return nil
	}
	if err := enableNginxVhostsForUser(username); err != nil {
		return err
	}
	_, _ = runArgv([]string{"pure-pw", "usermod", username, "-r", home}, "")
	_, _ = runArgv([]string{"sh", "-c", fmt.Sprintf("crontab -u %s -l 2>/dev/null | sed 's/^#SUSPENDED#//' | crontab -u %s -", shellQuote(username), shellQuote(username))}, "")
	_ = os.Remove(filepath.Join(home, ".webino_suspended"))
	_ = os.Remove(filepath.Join(home, ".webino_mail_locked"))
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
