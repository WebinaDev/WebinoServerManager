package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var wafSiteNameRe = regexp.MustCompile(`^[a-zA-Z0-9_.-]+$`)

func handleSecurityRisks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		checks := runRiskChecks()
		data, _ := json.Marshal(map[string]any{"checks": checks})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		id := strVal(body["id"])
		if action != "fix" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
			return
		}
		logOut, err := fixRiskCheck(id)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + logOut})
			return
		}
		data, _ := json.Marshal(map[string]string{"id": id, "log": logOut})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func runRiskChecks() []map[string]any {
	checks := []map[string]any{}

	// firewall
	fwOut, fwErr := runArgv([]string{"ufw", "status"}, "")
	fwActive := fwErr == nil && strings.Contains(strings.ToLower(fwOut), "active")
	checks = append(checks, map[string]any{
		"id": "firewall_active", "status": map[bool]string{true: "pass", false: "fail"}[fwActive],
		"title": "UFW firewall active", "fixable": true,
	})

	// fail2ban
	f2bOut, f2bErr := runArgv([]string{"systemctl", "is-active", "fail2ban"}, "")
	f2bOk := f2bErr == nil && strings.TrimSpace(f2bOut) == "active"
	checks = append(checks, map[string]any{
		"id": "fail2ban_active", "status": map[bool]string{true: "pass", false: "fail"}[f2bOk],
		"title": "Fail2ban service active", "fixable": true,
	})

	// ssh password auth
	sshd, _ := os.ReadFile("/etc/ssh/sshd_config")
	passAuth := true
	for _, line := range strings.Split(string(sshd), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(strings.ToLower(line), "passwordauthentication") {
			fields := strings.Fields(line)
			if len(fields) >= 2 && strings.EqualFold(fields[1], "no") {
				passAuth = false
			}
		}
	}
	checks = append(checks, map[string]any{
		"id": "ssh_password_auth", "status": map[bool]string{true: "fail", false: "pass"}[passAuth],
		"title": "SSH PasswordAuthentication disabled", "fixable": true,
	})

	// world-writable under /var/www (sample)
	ww := findWorldWritable(envOr("WEBINO_FILES_ROOT", "/var/www"), 3, 50)
	checks = append(checks, map[string]any{
		"id": "world_writable", "status": map[bool]string{true: "fail", false: "pass"}[len(ww) > 0],
		"title": "No world-writable paths under files root", "fixable": false,
		"detail": ww,
	})

	for _, wc := range exposedWeakPathChecks() {
		checks = append(checks, wc)
	}

	return checks
}

func findWorldWritable(root string, maxDepth, maxHits int) []string {
	out := []string{}
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || len(out) >= maxHits {
			return filepath.SkipAll
		}
		rel, _ := filepath.Rel(root, path)
		depth := 0
		if rel != "." {
			depth = strings.Count(rel, string(os.PathSeparator)) + 1
		}
		if depth > maxDepth {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		if info.Mode().Perm()&0o002 != 0 {
			out = append(out, path)
		}
		return nil
	})
	return out
}

func fixRiskCheck(id string) (string, error) {
	switch id {
	case "firewall_active":
		return runArgv([]string{"ufw", "--force", "enable"}, "")
	case "fail2ban_active":
		return runArgv([]string{"systemctl", "enable", "--now", "fail2ban"}, "")
	case "ssh_password_auth":
		// append PasswordAuthentication no if missing — write via temp careful
		path := "/etc/ssh/sshd_config.d/99-webino-hardening.conf"
		content := "PasswordAuthentication no\nChallengeResponseAuthentication no\n"
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return "", err
		}
		out, err := runArgv([]string{"sshd", "-t"}, "")
		if err != nil {
			return out, err
		}
		return runArgv([]string{"systemctl", "reload", "sshd"}, "")
	default:
		return "", fmt.Errorf("check not fixable: %s", id)
	}
}

func handleSecurityTamper(w http.ResponseWriter, r *http.Request) {
	base := envOr("WEBINO_TAMPER_BASE", "/var/lib/webino/tamper")
	_ = os.MkdirAll(base, 0o750)
	baselinePath := filepath.Join(base, "baseline.json")

	switch r.Method {
	case http.MethodGet:
		action := r.URL.Query().Get("action")
		if action == "" {
			action = "status"
		}
		switch action {
		case "status":
			_, err := os.Stat(baselinePath)
			data, _ := json.Marshal(map[string]any{"has_baseline": err == nil, "base": base})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		case "scan":
			diffs, err := scanTamperBaseline(baselinePath)
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]any{"diffs": diffs, "count": len(diffs)})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		}
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		paths := toStringSlice(body["paths"])
		if len(paths) == 0 {
			paths = []string{filepath.Join(envOr("WEBINO_FILES_ROOT", "/var/www"), ".webino-integrity")}
		}
		switch action {
		case "baseline":
			m, err := buildTamperBaseline(paths)
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			b, _ := json.MarshalIndent(m, "", "  ")
			if err := os.WriteFile(baselinePath, b, 0o640); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]any{"files": len(m), "path": baselinePath})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		}
	default:
		writeMethod(w)
	}
}

func buildTamperBaseline(paths []string) (map[string]string, error) {
	out := map[string]string{}
	root := envOr("WEBINO_FILES_ROOT", "/var/www")
	baseAbs, _ := filepath.Abs(root)
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		if abs != baseAbs && !strings.HasPrefix(abs, baseAbs+string(os.PathSeparator)) {
			// also allow under /etc/webino or panel paths fixed
			if !strings.HasPrefix(abs, "/etc/webino") && !strings.HasPrefix(abs, "/var/lib/webino") {
				continue
			}
		}
		info, err := os.Stat(abs)
		if err != nil {
			continue
		}
		if info.IsDir() {
			_ = filepath.WalkDir(abs, func(path string, d os.DirEntry, err error) error {
				if err != nil || d.IsDir() {
					return nil
				}
				h, err := hashFile(path)
				if err == nil {
					out[path] = h
				}
				return nil
			})
		} else {
			h, err := hashFile(abs)
			if err == nil {
				out[abs] = h
			}
		}
	}
	return out, nil
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func scanTamperBaseline(baselinePath string) ([]map[string]string, error) {
	b, err := os.ReadFile(baselinePath)
	if err != nil {
		return nil, err
	}
	var base map[string]string
	if err := json.Unmarshal(b, &base); err != nil {
		return nil, err
	}
	diffs := []map[string]string{}
	for path, want := range base {
		got, err := hashFile(path)
		if err != nil {
			diffs = append(diffs, map[string]string{"path": path, "status": "missing"})
			continue
		}
		if got != want {
			diffs = append(diffs, map[string]string{"path": path, "status": "changed"})
		}
	}
	return diffs, nil
}

func handleSystemDisk(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		roots := []string{
			envOr("WEBINO_FILES_ROOT", "/var/www"),
			"/var/tmp",
			"/tmp",
			"/var/cache",
		}
		items := []map[string]any{}
		for _, root := range roots {
			if _, err := os.Stat(root); err != nil {
				continue
			}
			size, _ := dirSizeLimited(root, 2)
			items = append(items, map[string]any{"path": root, "bytes": size})
		}
		data, _ := json.Marshal(map[string]any{"trees": items})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		path := strVal(body["path"])
		if action != "cleanup" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
			return
		}
		allowed := map[string]bool{
			"/var/tmp":                    true,
			"/tmp":                        true,
			"/var/cache/webino":           true,
			"/var/lib/webino/tmp":         true,
		}
		abs, _ := filepath.Abs(path)
		if !allowed[abs] {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "path not allowlisted for cleanup"})
			return
		}
		// only remove contents older pattern: clear files in dir, not the dir itself
		entries, err := os.ReadDir(abs)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		removed := 0
		for _, e := range entries {
			p := filepath.Join(abs, e.Name())
			if err := os.RemoveAll(p); err == nil {
				removed++
			}
		}
		data, _ := json.Marshal(map[string]any{"path": abs, "removed": removed})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func dirSizeLimited(root string, maxDepth int) (int64, error) {
	var total int64
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		depth := 0
		if rel != "." {
			depth = strings.Count(rel, string(os.PathSeparator)) + 1
		}
		if depth > maxDepth && d.IsDir() {
			return filepath.SkipDir
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err == nil {
			total += info.Size()
		}
		return nil
	})
	return total, nil
}

func handleSiteAnalytics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	fqdn := r.URL.Query().Get("fqdn")
	if fqdn == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "fqdn required"})
		return
	}
	maxLines := 5000
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 5000 {
			maxLines = n
		}
	}
	// resolve access log via same pattern as handlers_logs
	logPath := filepath.Join(envOr("WEBINO_NGINX_LOG_DIR", "/var/log/nginx"), fqdn+"-access.log")
	if _, err := os.Stat(logPath); err != nil {
		logPath = filepath.Join("/var/log/nginx", "access.log")
	}
	b, err := os.ReadFile(logPath)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	lines := strings.Split(string(b), "\n")
	if len(lines) > maxLines {
		lines = lines[len(lines)-maxLines:]
	}
	statusCounts := map[string]int{}
	total := 0
	bytesOut := int64(0)
	visitors := map[string]struct{}{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		total++
		parts := strings.Fields(line)
		if len(parts) > 0 {
			visitors[parts[0]] = struct{}{}
		}
		for _, code := range []string{"200", "301", "302", "304", "400", "401", "403", "404", "500", "502", "503"} {
			if strings.Contains(line, " "+code+" ") {
				statusCounts[code]++
				break
			}
		}
	}
	data, _ := json.Marshal(map[string]any{
		"fqdn":          fqdn,
		"log":           logPath,
		"requests":      total,
		"visitors":      len(visitors),
		"status_counts": statusCounts,
		"bytes_approx":  bytesOut,
		"top_paths":     parseTopPathsFromAccessLog(logPath, 10),
		"sampled_at":    time.Now().UTC().Format(time.RFC3339),
		"lines":         maxLines,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

// deepen WAF: list sites file + recent modsec log tail
func handleSecurityWafDeep(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		action := r.URL.Query().Get("action")
		if action == "logs" {
			logPath := envOr("WEBINO_MODSEC_LOG", "/var/log/modsec_audit.log")
			out, err := runArgv([]string{"tail", "-n", "100", logPath}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]string{"logs": out, "path": logPath})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
			return
		}
		// sites: list from nginx sites with optional .waf-enabled marker
		sitesDir := envOr("WEBINO_NGINX_SITES", "/etc/nginx/sites-available")
		entries, _ := os.ReadDir(sitesDir)
		sites := []map[string]any{}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if strings.HasSuffix(name, ".waf-on") || strings.HasSuffix(name, ".waf-geo-deny") {
				continue
			}
			marker := filepath.Join(sitesDir, name+".waf-on")
			_, err := os.Stat(marker)
			geoPath := filepath.Join(sitesDir, name+".waf-geo-deny")
			geoCountries := []string{}
			if raw, err := os.ReadFile(geoPath); err == nil {
				for _, line := range strings.Split(string(raw), "\n") {
					line = strings.TrimSpace(line)
					if line != "" {
						geoCountries = append(geoCountries, line)
					}
				}
			}
			sites = append(sites, map[string]any{
				"name":         name,
				"enabled":      err == nil,
				"geo_deny":     geoCountries,
			})
		}
		data, _ := json.Marshal(map[string]any{"sites": sites})
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
	name := strVal(body["name"])
	if name == "" || !wafSiteNameRe.MatchString(name) {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid name"})
		return
	}
	action := strVal(body["action"])
	if action == "geo_deny" {
		countries := toStringSlice(body["countries"])
		sitesDir := envOr("WEBINO_NGINX_SITES", "/etc/nginx/sites-available")
		marker := filepath.Join(sitesDir, name+".waf-geo-deny")
		if len(countries) == 0 {
			_ = os.Remove(marker)
		} else {
			allowed := map[string]bool{"CN": true, "RU": true, "KP": true, "IR": true, "US": true, "GB": true, "DE": true, "FR": true, "IN": true, "BR": true}
			lines := []string{}
			for _, c := range countries {
				c = strings.ToUpper(strings.TrimSpace(c))
				if len(c) == 2 && allowed[c] {
					lines = append(lines, c)
				}
			}
			if len(lines) == 0 {
				writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "no allowlisted country codes"})
				return
			}
			_ = os.WriteFile(marker, []byte(strings.Join(lines, "\n")+"\n"), 0o644)
		}
		data, _ := json.Marshal(map[string]any{"name": name, "countries": countries})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	enabled := body["enabled"] == true
	sitesDir := envOr("WEBINO_NGINX_SITES", "/etc/nginx/sites-available")
	marker := filepath.Join(sitesDir, name+".waf-on")
	if enabled {
		_ = os.WriteFile(marker, []byte("1\n"), 0o644)
	} else {
		_ = os.Remove(marker)
	}
	data, _ := json.Marshal(map[string]any{"name": name, "enabled": enabled})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}
