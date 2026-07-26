package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var (
	pdnsPrimaryNS  string
	pdnsHostmaster string
	mailVmapDir    string
	mailHome       string
	dovecotUserdb  string
	nginxSitesDir  string
	nginxEnabled   string
	apacheSitesDir string
	apacheEnabled  string
)

func initPhase7Env() {
	pdnsPrimaryNS = envOr("WEBINO_PDNS_PRIMARY_NS", "ns1.local.")
	pdnsHostmaster = envOr("WEBINO_PDNS_HOSTMASTER", "hostmaster.local.")
	mailVmapDir = envOr("WEBINO_MAIL_VMAP_DIR", "/etc/postfix")
	mailHome = envOr("WEBINO_MAIL_HOME", "/var/mail/vhosts")
	dovecotUserdb = envOr("WEBINO_DOVECOT_USERDB", "/etc/dovecot/users")
	nginxSitesDir = envOr("WEBINO_NGINX_SITES", "/etc/nginx/sites-available")
	nginxEnabled = envOr("WEBINO_NGINX_ENABLED", "/etc/nginx/sites-enabled")
	apacheSitesDir = envOr("WEBINO_APACHE_SITES", "/etc/apache2/sites-available")
	apacheEnabled = envOr("WEBINO_APACHE_ENABLED", "/etc/apache2/sites-enabled")
}

func handleDnsZones(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		zones, err := listPdnsZones()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"zones": zones})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Domain string `json:"domain"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}
	domain := strings.TrimSuffix(strings.ToLower(body.Domain), ".")
	if body.Action == "delete" {
		argv := []string{"pdnsutil", "delete-zone", domain}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: strings.Join(argv, " ")})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "output": out, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	ns := pdnsPrimaryNS
	if !strings.HasSuffix(ns, ".") {
		ns += "."
	}
	argv := []string{"pdnsutil", "create-zone", domain, ns}
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: strings.Join(argv, " ")})
		return
	}
	_, _ = runArgv([]string{"pdnsutil", "set-kind", domain, "native"}, "")
	_, _ = runArgv([]string{"pdnsutil", "rectify-zone", domain}, "")
	_, _ = runArgv([]string{"pdns_control", "notify", domain}, "")
	data, _ := json.Marshal(map[string]string{"domain": domain, "output": out, "action": "create"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDnsRecords(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	zone := strings.TrimSuffix(strings.ToLower(strVal(body["domain"])), ".")
	name := strVal(body["name"])
	recType := strings.ToUpper(strVal(body["type"]))
	content := strVal(body["content"])
	action := strVal(body["action"])
	if zone == "" || recType == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain and type required"})
		return
	}
	if name == "" {
		name = "@"
	}
	if action == "delete" {
		argv := []string{"pdnsutil", "delete-rrset", zone, name, recType}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: strings.Join(argv, " ")})
			return
		}
		data, _ := json.Marshal(map[string]string{"zone": zone, "name": name, "type": recType, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if content == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "content required"})
		return
	}
	ttl := strVal(body["ttl"])
	if ttl == "" {
		ttl = "3600"
	}
	if priority := strVal(body["priority"]); priority != "" && (recType == "MX" || recType == "SRV") {
		content = priority + " " + content
	}
	argv := []string{"pdnsutil", "add-record", zone, name, recType, ttl, content}
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: strings.Join(argv, " ")})
		return
	}
	_, _ = runArgv([]string{"pdnsutil", "rectify-zone", zone}, "")
	_, _ = runArgv([]string{"pdns_control", "notify", zone}, "")
	data, _ := json.Marshal(map[string]string{"zone": zone, "name": name, "type": recType, "output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailAccounts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		accounts := listMailAccountsFromMaps()
		data, _ := json.Marshal(map[string]any{"accounts": accounts})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Address  string `json:"address"`
		Password string `json:"password"`
		QuotaMB  int    `json:"quota_mb"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Address == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "address required"})
		return
	}
	address := strings.ToLower(body.Address)
	parts := strings.Split(address, "@")
	if len(parts) != 2 {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid address"})
		return
	}
	local, domain := parts[0], parts[1]
	vmailbox := filepath.Join(mailVmapDir, "vmailbox")
	vmailboxLine := fmt.Sprintf("%s %s/%s/", address, domain, local)

	if body.Action == "delete" {
		if err := removeMapLine(vmailbox, vmailboxLine); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		_ = removeDovecotUser(address)
		_ = postmapReload(vmailbox)
		data, _ := json.Marshal(map[string]string{"address": address, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Action == "passwd" {
		if body.Password == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "password required"})
			return
		}
		if err := setDovecotPassword(address, body.Password); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		_, _ = runArgv([]string{"doveadm", "reload"}, "")
		data, _ := json.Marshal(map[string]string{"address": address, "updated": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Action == "quota" {
		if body.QuotaMB <= 0 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "quota_mb required"})
			return
		}
		if err := setMailQuota(address, body.QuotaMB); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"address": address, "quota_mb": body.QuotaMB})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	maildir := filepath.Join(mailHome, domain, local)
	_ = os.MkdirAll(filepath.Join(maildir, "cur"), 0o700)
	_ = os.MkdirAll(filepath.Join(maildir, "new"), 0o700)
	_ = os.MkdirAll(filepath.Join(maildir, "tmp"), 0o700)
	if err := appendMapLine(vmailbox, vmailboxLine); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if body.Password != "" {
		if err := setDovecotPassword(address, body.Password); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
	}
	if err := postmapReload(vmailbox); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if body.QuotaMB > 0 {
		_ = setMailQuota(address, body.QuotaMB)
	}
	_, _ = runArgv([]string{"doveadm", "reload"}, "")
	data, _ := json.Marshal(map[string]string{"address": address, "maildir": maildir})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailForwarders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
		Action      string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Source == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "source required"})
		return
	}
	source := strings.ToLower(body.Source)
	virtual := filepath.Join(mailVmapDir, "virtual")
	line := fmt.Sprintf("%s %s", source, strings.ToLower(body.Destination))

	if body.Action == "delete" {
		if err := removeMapLineByPrefix(virtual, source+" "); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		_ = postmapReload(virtual)
		data, _ := json.Marshal(map[string]string{"source": source, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Destination == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "destination required"})
		return
	}
	if err := appendMapLine(virtual, line); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := postmapReload(virtual); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"source": source, "destination": body.Destination})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailDomains(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Domain string `json:"domain"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}
	domain := strings.ToLower(body.Domain)
	domainsFile := filepath.Join(mailVmapDir, "virtual_mailbox_domains")
	line := domain + " OK"

	if body.Action == "delete" {
		if err := removeMapLine(domainsFile, line); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		_ = postmapReload(domainsFile)
		data, _ := json.Marshal(map[string]string{"domain": domain, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if err := appendMapLine(domainsFile, line); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if err := postmapReload(domainsFile); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"domain": domain})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSubdomains(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action       string `json:"action"`
		Fqdn         string `json:"fqdn"`
		ParentDomain string `json:"parent_domain"`
		Subdomain    string `json:"subdomain"`
		DocumentRoot string `json:"document_root"`
		PhpPool      string `json:"php_pool"`
		PhpVersion   string `json:"php_version"`
		Ssl          bool   `json:"ssl"`
		ForceHTTPS   bool   `json:"force_https"`
		Hsts         bool   `json:"hsts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	fqdn := strings.ToLower(body.Fqdn)
	if fqdn == "" && body.Subdomain != "" && body.ParentDomain != "" {
		fqdn = strings.ToLower(body.Subdomain) + "." + strings.ToLower(body.ParentDomain)
	}
	if fqdn == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "fqdn required"})
		return
	}
	safeName := strings.ReplaceAll(fqdn, ".", "_")

	if body.Action == "delete" {
		if err := deleteNginxVhost(safeName); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"fqdn": fqdn, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	docRoot := body.DocumentRoot
	if docRoot == "" {
		docRoot = filepath.Join("sites", fqdn, "public")
	}
	absRoot, err := safeFilePath(docRoot)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	_ = os.MkdirAll(absRoot, 0o755)
	conf := buildNginxVhost(nginxVhostOpts{
		Fqdn:       fqdn,
		Root:       absRoot,
		PhpPool:    body.PhpPool,
		PhpVersion: body.PhpVersion,
		Ssl:        body.Ssl,
		ForceHTTPS: body.ForceHTTPS,
		Hsts:       body.Hsts,
	})
	if err := writeNginxVhost(safeName, conf); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	confPath, _ := vhostConfPath(safeName)
	data, _ := json.Marshal(map[string]string{"fqdn": fqdn, "document_root": docRoot, "config": confPath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func appendMapLine(path, line string) error {
	lines, err := readMapLines(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, l := range lines {
		if l == line {
			return nil
		}
	}
	lines = append(lines, line)
	return writeMapLines(path, lines)
}

func removeMapLine(path, line string) error {
	lines, err := readMapLines(path)
	if err != nil {
		return err
	}
	filtered := make([]string, 0, len(lines))
	for _, l := range lines {
		if l != line {
			filtered = append(filtered, l)
		}
	}
	return writeMapLines(path, filtered)
}

func removeMapLineByPrefix(path, prefix string) error {
	lines, err := readMapLines(path)
	if err != nil {
		return err
	}
	filtered := make([]string, 0, len(lines))
	for _, l := range lines {
		if !strings.HasPrefix(l, prefix) {
			filtered = append(filtered, l)
		}
	}
	return writeMapLines(path, filtered)
}

func readMapLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	return lines, sc.Err()
}

func writeMapLines(path string, lines []string) error {
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	content := strings.Join(lines, "\n")
	if content != "" {
		content += "\n"
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func postmapReload(mapPath string) error {
	_, err := runArgv([]string{"postmap", mapPath}, "")
	if err != nil {
		return err
	}
	_, err = runArgv([]string{"postfix", "reload"}, "")
	return err
}

func setDovecotPassword(address, password string) error {
	out, err := runArgv([]string{"doveadm", "pw", "-p", password, "-s", "SHA512-CRYPT"}, "")
	if err != nil {
		return err
	}
	hash := strings.TrimSpace(out)
	line := fmt.Sprintf("%s:%s:5000:5000::%s", address, hash, mailHome)
	lines, _ := readMapLines(dovecotUserdb)
	found := false
	prefix := address + ":"
	filtered := make([]string, 0, len(lines))
	for _, l := range lines {
		if strings.HasPrefix(l, prefix) {
			filtered = append(filtered, line)
			found = true
		} else {
			filtered = append(filtered, l)
		}
	}
	if !found {
		filtered = append(filtered, line)
	}
	return writeMapLines(dovecotUserdb, filtered)
}

func removeDovecotUser(address string) error {
	lines, err := readMapLines(dovecotUserdb)
	if err != nil {
		return err
	}
	prefix := address + ":"
	filtered := make([]string, 0, len(lines))
	for _, l := range lines {
		if !strings.HasPrefix(l, prefix) {
			filtered = append(filtered, l)
		}
	}
	return writeMapLines(dovecotUserdb, filtered)
}

func reloadNginx() (string, error) {
	if out, err := runArgv([]string{"nginx", "-t"}, ""); err != nil {
		return out, err
	}
	return runArgv([]string{"nginx", "-s", "reload"}, "")
}

func strVal(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return fmt.Sprintf("%.0f", t)
	default:
		return fmt.Sprint(t)
	}
}

func formatMailMapLine(source, destination string) string {
	return source + " " + destination
}

func buildPdnsRecordArgs(zone, name, recType, ttl, content string, priority string) []string {
	if priority != "" && (recType == "MX" || recType == "SRV") {
		content = priority + " " + content
	}
	if ttl == "" {
		ttl = "3600"
	}
	return []string{"pdnsutil", "add-record", zone, name, recType, ttl, content}
}
