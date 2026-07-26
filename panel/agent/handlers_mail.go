package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	rspamdLocalDir string
	dkimKeyDir     string
)

func initMailEnv() {
	rspamdLocalDir = envOr("WEBINO_RSPAMD_LOCAL", "/etc/rspamd/local.d")
	dkimKeyDir = envOr("WEBINO_DKIM_KEY_DIR", "/etc/rspamd/dkim")
}

func handleMailDkim(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		domain := strings.TrimSpace(r.URL.Query().Get("domain"))
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		selector := envOr("WEBINO_DKIM_SELECTOR", "default")
		pub := readDkimPublicKey(domain, selector)
		data, _ := json.Marshal(map[string]string{
			"domain":     domain,
			"selector":   selector,
			"public_key": pub,
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Domain   string `json:"domain"`
		Selector string `json:"selector"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}
	if body.Action != "generate" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unsupported action"})
		return
	}
	selector := body.Selector
	if selector == "" {
		selector = "default"
	}
	_ = os.MkdirAll(dkimKeyDir, 0o755)
	keyPath := filepath.Join(dkimKeyDir, body.Domain+"."+selector+".key")
	out, err := runArgv([]string{"rspamadm", "dkim_keygen", "-s", selector, "-b", "2048", "-k", keyPath}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: out})
		return
	}
	pub := readDkimPublicKey(body.Domain, selector)
	txt := buildDkimTxtRecord(selector, pub)
	data, _ := json.Marshal(map[string]string{
		"domain":     body.Domain,
		"selector":   selector,
		"public_key": pub,
		"txt_record": txt,
		"output":     out,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailAntispam(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		grey := readRspamdToggle("greylisting.conf")
		antispam := readRspamdToggle("antivirus.conf")
		data, _ := json.Marshal(map[string]any{
			"greylisting": grey,
			"antispam":    antispam,
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Greylisting *bool `json:"greylisting"`
		Antispam    *bool `json:"antispam"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if body.Greylisting != nil {
		_ = writeRspamdToggle("greylisting.conf", *body.Greylisting, "greylist { enabled = %t; }")
	}
	if body.Antispam != nil {
		_ = writeRspamdToggle("antivirus.conf", *body.Antispam, "clamav { enabled = %t; }")
	}
	_, _ = runArgv([]string{"systemctl", "restart", "rspamd"}, "")
	data, _ := json.Marshal(map[string]string{"restarted": "rspamd"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailAutoresponders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Address  string `json:"address"`
		Subject  string `json:"subject"`
		Body     string `json:"body"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Address == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "address required"})
		return
	}
	parts := strings.Split(strings.ToLower(body.Address), "@")
	if len(parts) != 2 {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid address"})
		return
	}
	sievePath := filepath.Join(mailHome, parts[1], parts[0], ".dovecot.sieve")
	if body.Action == "delete" {
		_ = os.Remove(sievePath)
		_ = os.Remove(sievePath + "c")
		data, _ := json.Marshal(map[string]string{"address": body.Address, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	script := buildVacationSieve(body.Subject, body.Body)
	if err := os.WriteFile(sievePath, []byte(script), 0o600); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"sievec", sievePath}, "")
	data, _ := json.Marshal(map[string]string{"address": body.Address, "path": sievePath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailLists(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Source       string   `json:"source"`
		Destinations []string `json:"destinations"`
		Action       string   `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Source == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "source required"})
		return
	}
	virtual := filepath.Join(mailVmapDir, "virtual")
	line := strings.ToLower(body.Source) + " " + strings.Join(body.Destinations, ",")
	if body.Action == "delete" {
		_ = removeMapLineByPrefix(virtual, strings.ToLower(body.Source)+" ")
		_ = postmapReload(virtual)
		data, _ := json.Marshal(map[string]string{"source": body.Source, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Action == "update" {
		_ = removeMapLineByPrefix(virtual, strings.ToLower(body.Source)+" ")
		if len(body.Destinations) > 0 {
			if err := appendMapLine(virtual, line); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
		}
		_ = postmapReload(virtual)
		data, _ := json.Marshal(map[string]string{"source": body.Source, "updated": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if len(body.Destinations) == 0 {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "destinations required"})
		return
	}
	if err := appendMapLine(virtual, line); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_ = postmapReload(virtual)
	data, _ := json.Marshal(map[string]string{"source": body.Source, "line": line})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailCatchall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Domain      string `json:"domain"`
		Destination string `json:"destination"`
		Action      string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}
	virtual := filepath.Join(mailVmapDir, "virtual")
	prefix := "@" + strings.ToLower(body.Domain) + " "
	if body.Action == "delete" {
		_ = removeMapLineByPrefix(virtual, prefix)
		_ = postmapReload(virtual)
		data, _ := json.Marshal(map[string]string{"domain": body.Domain, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if body.Destination == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "destination required"})
		return
	}
	line := prefix + strings.ToLower(body.Destination)
	if err := appendMapLine(virtual, line); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_ = postmapReload(virtual)
	data, _ := json.Marshal(map[string]string{"domain": body.Domain, "destination": body.Destination})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailQuota(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	addresses := strings.TrimSpace(r.URL.Query().Get("addresses"))
	if addresses != "" {
		result := map[string]any{}
		for _, addr := range strings.Split(addresses, ",") {
			addr = strings.TrimSpace(addr)
			if addr == "" {
				continue
			}
			out, err := runArgv([]string{"doveadm", "quota", "get", "-u", addr}, "")
			if err != nil {
				result[addr] = map[string]string{"error": err.Error()}
				continue
			}
			result[addr] = parseDoveadmQuota(out)
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	address := strings.TrimSpace(r.URL.Query().Get("address"))
	if address == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "address required"})
		return
	}
	out, err := runArgv([]string{"doveadm", "quota", "get", "-u", address}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	usage := parseDoveadmQuota(out)
	data, _ := json.Marshal(usage)
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleMailQueue(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		out, err := runArgv([]string{"postqueue", "-p"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		entries := parsePostqueue(out)
		data, _ := json.Marshal(map[string]any{"entries": entries, "raw": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		ID     string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	var argv []string
	switch body.Action {
	case "flush":
		argv = []string{"postqueue", "-f"}
	case "delete":
		if body.ID == "" {
			argv = []string{"postsuper", "-d", "ALL"}
		} else {
			argv = []string{"postsuper", "-d", body.ID}
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

func readDkimPublicKey(domain, selector string) string {
	keyPath := filepath.Join(dkimKeyDir, domain+"."+selector+".key")
	b, err := os.ReadFile(keyPath)
	if err != nil {
		return ""
	}
	re := regexp.MustCompile(`p=([A-Za-z0-9+/=]+)`)
	m := re.FindStringSubmatch(string(b))
	if len(m) > 1 {
		return m[1]
	}
	return strings.TrimSpace(string(b))
}

func buildDkimTxtRecord(selector, publicKey string) string {
	if publicKey == "" {
		return ""
	}
	return fmt.Sprintf("v=DKIM1; k=rsa; p=%s", publicKey)
}

func buildVacationSieve(subject, body string) string {
	if subject == "" {
		subject = "Out of office"
	}
	if body == "" {
		body = "I am currently away."
	}
	return fmt.Sprintf(`require ["vacation"];
vacation :days 1 :subject "%s" "%s";
`, strings.ReplaceAll(subject, `"`, `\"`), strings.ReplaceAll(body, `"`, `\"`))
}

func readRspamdToggle(filename string) bool {
	path := filepath.Join(rspamdLocalDir, filename)
	b, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.Contains(string(b), "enabled = true")
}

func writeRspamdToggle(filename string, enabled bool, template string) error {
	_ = os.MkdirAll(rspamdLocalDir, 0o755)
	content := fmt.Sprintf(template, enabled)
	return os.WriteFile(filepath.Join(rspamdLocalDir, filename), []byte(content), 0o644)
}

func parseDoveadmQuota(out string) map[string]any {
	result := map[string]any{"used_bytes": 0, "limit_bytes": 0, "percent": 0.0}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "STORAGE") {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				result["used_bytes"] = fields[1]
				result["limit_bytes"] = fields[2]
			}
		}
	}
	return result
}

func parsePostqueue(out string) []map[string]string {
	entries := make([]map[string]string, 0)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if len(line) < 10 || strings.HasPrefix(line, "-") || strings.HasPrefix(line, "Queue") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 5 {
			entries = append(entries, map[string]string{
				"id":       fields[0],
				"size":     fields[1],
				"arrival":  fields[2],
				"sender":   fields[5],
				"recipient": fields[len(fields)-1],
			})
		}
	}
	return entries
}
