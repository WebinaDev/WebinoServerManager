package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type dnsRecordRow struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	TTL      string `json:"ttl,omitempty"`
	Priority string `json:"priority,omitempty"`
}

func handleDnsZonesExtended(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		if r.URL.Query().Get("export") != "" {
			handleDnsZoneExport(w, r)
			return
		}
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
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	domain := strings.TrimSuffix(strings.ToLower(strVal(body["domain"])), ".")
	action := strVal(body["action"])
	if domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}

	switch action {
	case "delete":
		argv := []string{"pdnsutil", "delete-zone", domain}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "output": out, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "slave":
		master := strVal(body["master_ns"])
		if master == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "master_ns required"})
			return
		}
		if !strings.HasSuffix(master, ".") {
			master += "."
		}
		_, _ = runArgv([]string{"pdnsutil", "create-zone", domain, master}, "")
		out, err := runArgv([]string{"pdnsutil", "set-kind", domain, "slave"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "kind": "slave", "master": master, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "dnssec_enable":
		_, _ = runArgv([]string{"pdnsutil", "secure-zone", domain}, "")
		_, _ = runArgv([]string{"pdnsutil", "set-nsec3", domain, "1 0 0 -"}, "")
		out, err := runArgv([]string{"pdnsutil", "rectify-zone", domain}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "dnssec": "enabled", "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "dnssec_disable":
		out, err := runArgv([]string{"pdnsutil", "unset-nsec3", domain}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "dnssec": "disabled", "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "import":
		content := strVal(body["content"])
		if content == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "content required"})
			return
		}
		tmp := filepath.Join(os.TempDir(), "webino-zone-"+domain+".bind")
		if err := os.WriteFile(tmp, []byte(content), 0o600); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		defer os.Remove(tmp)
		out, err := runArgv([]string{"pdnsutil", "load-zone", domain, tmp}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "apply_template":
		template := strVal(body["template"])
		records := templateRecords(template, domain)
		for _, rec := range records {
			argv := buildPdnsRecordArgs(domain, rec.Name, rec.Type, rec.TTL, rec.Content, rec.Priority)
			if _, err := runArgv(argv, ""); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
		}
		_, _ = runArgv([]string{"pdnsutil", "rectify-zone", domain}, "")
		data, _ := json.Marshal(map[string]any{"domain": domain, "records": len(records)})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		ns := pdnsPrimaryNS
		if !strings.HasSuffix(ns, ".") {
			ns += "."
		}
		argv := []string{"pdnsutil", "create-zone", domain, ns}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		_, _ = runArgv([]string{"pdnsutil", "set-kind", domain, "native"}, "")
		_, _ = runArgv([]string{"pdnsutil", "rectify-zone", domain}, "")
		_, _ = runArgv([]string{"pdns_control", "notify", domain}, "")
		data, _ := json.Marshal(map[string]string{"domain": domain, "output": out, "action": "create"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	}
}

func handleDnsZoneExport(w http.ResponseWriter, r *http.Request) {
	domain := strings.TrimSuffix(strings.ToLower(r.URL.Query().Get("domain")), ".")
	if domain == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
		return
	}
	out, err := runArgv([]string{"pdnsutil", "export-zone", domain}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"domain": domain, "content": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDnsRecordsExtended(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		domain := strings.TrimSuffix(strings.ToLower(r.URL.Query().Get("domain")), ".")
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		records, err := listZoneRecords(domain)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"records": records})
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
	zone := strings.TrimSuffix(strings.ToLower(strVal(body["domain"])), ".")
	name := strVal(body["name"])
	recType := strings.ToUpper(strVal(body["type"]))
	content := strVal(body["content"])
	action := strVal(body["action"])
	oldName := strVal(body["old_name"])
	oldType := strings.ToUpper(strVal(body["old_type"]))
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
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"zone": zone, "name": name, "type": recType, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if action == "update" {
		if oldName == "" {
			oldName = name
		}
		if oldType == "" {
			oldType = recType
		}
		_, _ = runArgv([]string{"pdnsutil", "delete-rrset", zone, oldName, oldType}, "")
	}
	if content == "" && action != "delete" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "content required"})
		return
	}
	ttl := strVal(body["ttl"])
	if ttl == "" {
		ttl = "3600"
	}
	priority := strVal(body["priority"])
	recContent := content
	if priority != "" && (recType == "MX" || recType == "SRV") {
		recContent = priority + " " + content
	}
	argv := buildPdnsRecordArgs(zone, name, recType, ttl, recContent, "")
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	_, _ = runArgv([]string{"pdnsutil", "rectify-zone", zone}, "")
	_, _ = runArgv([]string{"pdns_control", "notify", zone}, "")
	data, _ := json.Marshal(map[string]string{"zone": zone, "name": name, "type": recType, "output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func listZoneRecords(domain string) ([]dnsRecordRow, error) {
	out, err := runArgv([]string{"pdnsutil", "list-zone", domain}, "")
	if err != nil {
		return nil, err
	}
	return parseListZone(out), nil
}

func parseListZone(out string) []dnsRecordRow {
	records := make([]dnsRecordRow, 0)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "$") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		idx := 1
		ttl := fields[idx]
		idx++
		if idx < len(fields) && strings.EqualFold(fields[idx], "IN") {
			idx++
		}
		if idx >= len(fields) {
			continue
		}
		recType := strings.ToUpper(fields[idx])
		idx++
		content := strings.Join(fields[idx:], " ")
		rec := dnsRecordRow{
			Name:    fields[0],
			TTL:     ttl,
			Type:    recType,
			Content: content,
		}
		if rec.Type == "MX" || rec.Type == "SRV" {
			parts := strings.Fields(rec.Content)
			if len(parts) >= 2 {
				rec.Priority = parts[0]
				rec.Content = strings.Join(parts[1:], " ")
			}
		}
		records = append(records, rec)
	}
	return records
}

func templateRecords(name, domain string) []dnsRecordRow {
	switch name {
	case "web_hosting":
		return []dnsRecordRow{
			{Name: "@", Type: "MX", TTL: "3600", Priority: "10", Content: "mail." + domain + "."},
			{Name: "@", Type: "TXT", TTL: "3600", Content: "v=spf1 mx ~all"},
			{Name: "@", Type: "A", TTL: "3600", Content: "127.0.0.1"},
		}
	default:
		return []dnsRecordRow{
			{Name: "@", Type: "A", TTL: "3600", Content: "127.0.0.1"},
		}
	}
}

func ptrZoneFromIP(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return ""
	}
	return fmt.Sprintf("%s.%s.%s.%s.in-addr.arpa", parts[3], parts[2], parts[1], parts[0])
}

func handleDnsRecordCounts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	zonesOut, err := runArgv([]string{"pdnsutil", "list-all-zones"}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	counts := map[string]int{}
	for _, zone := range strings.Fields(zonesOut) {
		zone = strings.TrimSpace(zone)
		if zone == "" {
			continue
		}
		records, listErr := listZoneRecords(zone)
		if listErr != nil {
			continue
		}
		counts[strings.ToLower(zone)] = len(records)
	}
	data, _ := json.Marshal(counts)
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}
