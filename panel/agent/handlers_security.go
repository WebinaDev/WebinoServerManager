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

var (
	sshAuthKeysPath string
	modSecConfPath  string
	modSecLinkPath  string
)

func initSecurityEnv() {
	sshAuthKeysPath = envOr("WEBINO_SSH_AUTHKEYS", "/root/.ssh/authorized_keys")
	modSecConfPath = envOr("WEBINO_MODSEC_CONF", "/etc/nginx/modules-enabled/50-mod-http-modsecurity.conf")
	modSecLinkPath = envOr("WEBINO_MODSEC_LINK", "/etc/nginx/modules-available/50-mod-http-modsecurity.conf")
}

func handleSecurityFirewall(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		out, err := runArgv([]string{"ufw", "status", "numbered"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		rules := parseUfwStatus(out)
		enabled := strings.Contains(strings.ToLower(out), "status: active")
		data, _ := json.Marshal(map[string]any{"enabled": enabled, "rules": rules, "raw": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action   string `json:"action"`
		Port     string `json:"port"`
		Proto    string `json:"proto"`
		RuleNum  int    `json:"rule_num"`
		Preset   string `json:"preset"`
		FromIP   string `json:"from_ip"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	var argv []string
	switch body.Action {
	case "enable":
		argv = []string{"ufw", "--force", "enable"}
	case "disable":
		argv = []string{"ufw", "disable"}
	case "allow":
		if body.Port == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "port required"})
			return
		}
		proto := body.Proto
		if proto == "" {
			proto = "tcp"
		}
		if err := validateUfwPort(body.Port); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if err := validateUfwProto(proto); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if body.FromIP != "" {
			if err := validateIpAddress(body.FromIP); err != nil {
				writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
				return
			}
			argv = []string{"ufw", "allow", "from", body.FromIP, "to", "any", "port", body.Port, "proto", proto}
		} else {
			argv = []string{"ufw", "allow", body.Port + "/" + proto}
		}
	case "deny":
		if body.Port == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "port required"})
			return
		}
		proto := body.Proto
		if proto == "" {
			proto = "tcp"
		}
		if err := validateUfwPort(body.Port); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if err := validateUfwProto(proto); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if body.FromIP != "" {
			if err := validateIpAddress(body.FromIP); err != nil {
				writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
				return
			}
			argv = []string{"ufw", "deny", "from", body.FromIP, "to", "any", "port", body.Port, "proto", proto}
		} else {
			argv = []string{"ufw", "deny", body.Port + "/" + proto}
		}
	case "delete":
		if body.RuleNum <= 0 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "rule_num required"})
			return
		}
		argv = []string{"ufw", "--force", "delete", strconv.Itoa(body.RuleNum)}
	case "preset":
		switch body.Preset {
		case "web":
			_, _ = runArgv([]string{"ufw", "allow", "80/tcp"}, "")
			_, _ = runArgv([]string{"ufw", "allow", "443/tcp"}, "")
			out, err := runArgv([]string{"ufw", "status", "numbered"}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]string{"output": out, "preset": "web"})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
			return
		case "ssh":
			out, err := runArgv([]string{"ufw", "allow", "22/tcp"}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]string{"output": out, "preset": "ssh"})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
			return
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown preset"})
			return
		}
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		return
	}
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out, "action": body.Action})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSecurityFail2ban(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		out, err := runArgv([]string{"fail2ban-client", "status"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		jails := parseFail2banStatus(out)
		jailDetails := make([]map[string]any, 0)
		for _, jail := range jails {
			jout, _ := runArgv([]string{"fail2ban-client", "status", jail}, "")
			jailDetails = append(jailDetails, map[string]any{
				"name":   jail,
				"detail": jout,
			})
		}
		data, _ := json.Marshal(map[string]any{"jails": jailDetails, "raw": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		Jail   string `json:"jail"`
		IP     string `json:"ip"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Jail == "" || body.IP == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "jail and ip required"})
		return
	}
	if body.Action != "unban" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unsupported action"})
		return
	}
	out, err := runArgv([]string{"fail2ban-client", "set", body.Jail, "unbanip", body.IP}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out, "jail": body.Jail, "ip": body.IP})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSecurityFail2banFilters(w http.ResponseWriter, r *http.Request) {
	filterDir := envOr("WEBINO_FAIL2BAN_FILTER_DIR", "/etc/fail2ban/filter.d")
	if r.Method == http.MethodGet {
		filters := listFail2banFilters(filterDir)
		data, _ := json.Marshal(map[string]any{"filters": filters})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
		Action  string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	baseName := strings.TrimSuffix(body.Name, ".conf")
	if err := validateSafeName(baseName, 64); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	filterPath, err := jailPathUnder(filterDir, baseName+".conf")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	if body.Action == "delete" {
		_ = os.Remove(filterPath)
		_, _ = runArgv([]string{"fail2ban-client", "reload"}, "")
		data, _ := json.Marshal(map[string]string{"name": baseName, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if err := os.MkdirAll(filterDir, 0o755); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := os.WriteFile(filterPath, []byte(body.Content), 0o644); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"fail2ban-client", "reload"}, "")
	data, _ := json.Marshal(map[string]string{"name": baseName, "path": filterPath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func listFail2banFilters(filterDir string) []map[string]string {
	entries, err := os.ReadDir(filterDir)
	if err != nil {
		return []map[string]string{}
	}
	filters := make([]map[string]string, 0)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".conf") {
			continue
		}
		path := filepath.Join(filterDir, e.Name())
		content, _ := os.ReadFile(path)
		filters = append(filters, map[string]string{
			"name":    strings.TrimSuffix(e.Name(), ".conf"),
			"content": string(content),
		})
	}
	return filters
}

func handleSecuritySshKeys(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		keys, err := readAuthorizedKeys()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"keys": keys, "path": sshAuthKeysPath})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		Key    string `json:"key"`
		Label  string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	switch body.Action {
	case "add":
		if body.Key == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "key required"})
			return
		}
		if err := validateSshPublicKey(body.Key); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		line := strings.TrimSpace(body.Key)
		if body.Label != "" {
			if strings.ContainsAny(body.Label, "\n\r") {
				writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid label"})
				return
			}
			line += " " + strings.TrimSpace(body.Label)
		}
		if err := addAuthorizedKey(line); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
	case "delete":
		if body.Key == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "key required"})
			return
		}
		if err := removeAuthorizedKey(strings.TrimSpace(body.Key)); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		return
	}
	data, _ := json.Marshal(map[string]string{"action": body.Action})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSecurityClamav(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		Path   string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Action != "scan" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "action scan required"})
		return
	}
	scanPath := body.Path
	if scanPath == "" {
		scanPath = "."
	}
	abs, err := safeFilePath(scanPath)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	out, scanErr := runArgv([]string{"clamscan", "-r", "--infected", abs}, "")
	infected := parseClamscanInfected(out)
	data, _ := json.Marshal(map[string]any{
		"infected": infected,
		"count":    len(infected),
		"output":   out,
		"ok":       scanErr == nil && len(infected) == 0,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSecurityWaf(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		enabled := false
		if _, err := os.Lstat(modSecConfPath); err == nil {
			enabled = true
		}
		data, _ := json.Marshal(map[string]any{"enabled": enabled, "conf": modSecConfPath})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if body.Enabled {
		_ = os.Remove(modSecConfPath)
		if err := os.Symlink(modSecLinkPath, modSecConfPath); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
	} else {
		_ = os.Remove(modSecConfPath)
	}
	if _, err := runArgv([]string{"nginx", "-t"}, ""); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"systemctl", "reload", "nginx"}, "")
	data, _ := json.Marshal(map[string]bool{"enabled": body.Enabled})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func parseUfwStatus(out string) []map[string]string {
	rules := make([]map[string]string, 0)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		num := strings.Trim(parts[0], "[]")
		rules = append(rules, map[string]string{
			"num":  num,
			"rule": strings.Join(parts[1:], " "),
		})
	}
	return rules
}

func parseFail2banStatus(out string) []string {
	jails := make([]string, 0)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(line), "|- jail list:") {
			list := strings.TrimPrefix(line, "|- Jail list:")
			list = strings.TrimSpace(list)
			for _, j := range strings.Split(list, ",") {
				j = strings.TrimSpace(j)
				if j != "" {
					jails = append(jails, j)
				}
			}
		}
	}
	return jails
}

func readAuthorizedKeys() ([]string, error) {
	b, err := os.ReadFile(sshAuthKeysPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	keys := make([]string, 0)
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			keys = append(keys, line)
		}
	}
	return keys, nil
}

func addAuthorizedKey(line string) error {
	keys, err := readAuthorizedKeys()
	if err != nil {
		return err
	}
	for _, k := range keys {
		if strings.HasPrefix(k, strings.Fields(line)[0]) {
			return nil
		}
	}
	_ = os.MkdirAll(filepath.Dir(sshAuthKeysPath), 0o700)
	f, err := os.OpenFile(sshAuthKeysPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintln(f, line)
	return err
}

func removeAuthorizedKey(keyPrefix string) error {
	keys, err := readAuthorizedKeys()
	if err != nil {
		return err
	}
	filtered := make([]string, 0, len(keys))
	for _, k := range keys {
		if !strings.HasPrefix(k, keyPrefix) {
			filtered = append(filtered, k)
		}
	}
	content := strings.Join(filtered, "\n")
	if content != "" {
		content += "\n"
	}
	return os.WriteFile(sshAuthKeysPath, []byte(content), 0o600)
}

func parseClamscanInfected(out string) []string {
	infected := make([]string, 0)
	for _, line := range strings.Split(out, "\n") {
		if strings.HasSuffix(line, " FOUND") {
			parts := strings.SplitN(line, ": ", 2)
			if len(parts) == 2 {
				infected = append(infected, parts[0])
			}
		}
	}
	return infected
}
