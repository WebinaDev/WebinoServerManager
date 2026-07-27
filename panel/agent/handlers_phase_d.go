package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var nginxAccessPathRe = regexp.MustCompile(`"([A-Z]+)\s+([^\s?"]+)`)

func listMongoDatabases() ([]map[string]any, error) {
	out, err := runArgv([]string{"mongosh", "--quiet", "--eval", "db.adminCommand('listDatabases').databases.map(d=>d.name).join('\\n')"}, "")
	if err != nil {
		return nil, fmt.Errorf("mongodb unavailable: %w", err)
	}
	dbs := []map[string]any{}
	for _, line := range strings.Split(out, "\n") {
		name := strings.TrimSpace(line)
		if name == "" || name == "admin" || name == "config" || name == "local" {
			continue
		}
		dbs = append(dbs, map[string]any{"name": name, "engine": "mongodb", "size_mb": 0})
	}
	return dbs, nil
}

func mongoCreateDatabase(name string) error {
	if err := validateSafeName(name, 64); err != nil {
		return err
	}
	script := fmt.Sprintf("use %s; db.createCollection('_init');", mongoQuoteIdent(name))
	_, err := runArgv([]string{"mongosh", "--quiet", "--eval", script}, "")
	return err
}

func mongoDropDatabase(name string) error {
	if err := validateSafeName(name, 64); err != nil {
		return err
	}
	script := fmt.Sprintf("use %s; db.dropDatabase();", mongoQuoteIdent(name))
	_, err := runArgv([]string{"mongosh", "--quiet", "--eval", script}, "")
	return err
}

func mongoQuoteIdent(name string) string {
	return strings.ReplaceAll(name, "'", "\\'")
}

func redisInfoPayload() (map[string]any, error) {
	pingOut, err := runArgv([]string{"redis-cli", "ping"}, "")
	if err != nil || !strings.Contains(strings.ToUpper(pingOut), "PONG") {
		return nil, fmt.Errorf("redis not responding")
	}
	infoOut, err := runArgv([]string{"redis-cli", "INFO", "memory"}, "")
	if err != nil {
		return nil, err
	}
	memUsed := int64(0)
	for _, line := range strings.Split(infoOut, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "used_memory:") {
			fmt.Sscanf(strings.TrimPrefix(line, "used_memory:"), "%d", &memUsed)
		}
	}
	return map[string]any{
		"ping":         "PONG",
		"memory_bytes": memUsed,
		"memory_mb":    memUsed / (1024 * 1024),
		"info_memory":  infoOut,
	}, nil
}

func mongoInfoPayload() (map[string]any, error) {
	out, err := runArgv([]string{"mongosh", "--quiet", "--eval", "JSON.stringify(db.adminCommand({ ping: 1 }))"}, "")
	if err != nil {
		return nil, fmt.Errorf("mongodb unavailable: %w", err)
	}
	dbs, listErr := listMongoDatabases()
	count := 0
	if listErr == nil {
		count = len(dbs)
	}
	return map[string]any{
		"ping":            strings.TrimSpace(out),
		"database_count":  count,
		"ok":              strings.Contains(out, `"ok":1`) || strings.Contains(out, `"ok": 1`),
	}, nil
}

func handleDnsAlidnsProvider(w http.ResponseWriter, r *http.Request) {
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
	token := strVal(body["api_token"])
	zoneID := strVal(body["zone_id"])
	switch action {
	case "configure":
		data, _ := json.Marshal(map[string]any{"configured": strVal(body["enabled"]) == "true" || body["enabled"] == true})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	case "sync_records", "dns01":
		if token == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "api_token required"})
			return
		}
		if zoneID == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "zone_id required for AliDNS"})
			return
		}
		accessKeyID, accessKeySecret, err := parseAlidnsCredentials(token)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		if action == "dns01" {
			recordName := strVal(body["record_name"])
			recordValue := strVal(body["record_value"])
			if err := alidnsUpsertRecord(accessKeyID, accessKeySecret, zoneID, map[string]any{
				"type":    "TXT",
				"name":    recordName,
				"content": recordValue,
			}); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
			data, _ := json.Marshal(map[string]string{"record_name": recordName, "action": "dns01"})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
			return
		}
		records, ok := body["records"].([]any)
		if !ok || len(records) == 0 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "records required"})
			return
		}
		synced := 0
		for _, item := range records {
			row, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if err := alidnsUpsertRecord(accessKeyID, accessKeySecret, zoneID, row); err == nil {
				synced++
			}
		}
		data, _ := json.Marshal(map[string]any{"synced": synced, "domain": strVal(body["domain"])})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

// parseAlidnsCredentials accepts "AccessKeyId:AccessKeySecret" or "AccessKeyId|AccessKeySecret".
func parseAlidnsCredentials(token string) (string, string, error) {
	token = strings.TrimSpace(token)
	sep := ""
	if strings.Contains(token, "|") {
		sep = "|"
	} else if strings.Contains(token, ":") {
		sep = ":"
	} else {
		return "", "", fmt.Errorf("api_token must be AccessKeyId:AccessKeySecret")
	}
	parts := strings.SplitN(token, sep, 2)
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", fmt.Errorf("api_token must be AccessKeyId:AccessKeySecret")
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
}

func alidnsRR(domain, name string) string {
	domain = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(domain)), ".")
	name = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(name)), ".")
	if name == "" || name == "@" || name == domain {
		return "@"
	}
	suffix := "." + domain
	if strings.HasSuffix(name, suffix) {
		rr := strings.TrimSuffix(name, suffix)
		if rr == "" {
			return "@"
		}
		return rr
	}
	return name
}

func alidnsUpsertRecord(accessKeyID, accessKeySecret, domain string, row map[string]any) error {
	rr := alidnsRR(domain, strVal(row["name"]))
	recType := strings.ToUpper(strVal(row["type"]))
	value := strVal(row["content"])
	if recType == "" || value == "" {
		return fmt.Errorf("type and content required")
	}
	recordID, err := alidnsFindRecordID(accessKeyID, accessKeySecret, domain, rr, recType)
	if err != nil {
		return err
	}
	params := map[string]string{
		"DomainName": domain,
		"RR":         rr,
		"Type":       recType,
		"Value":      value,
		"TTL":        "600",
	}
	if recordID != "" {
		params["Action"] = "UpdateDomainRecord"
		params["RecordId"] = recordID
		delete(params, "DomainName")
	} else {
		params["Action"] = "AddDomainRecord"
	}
	_, err = alidnsRPC(accessKeyID, accessKeySecret, params)
	return err
}

func alidnsFindRecordID(accessKeyID, accessKeySecret, domain, rr, recType string) (string, error) {
	raw, err := alidnsRPC(accessKeyID, accessKeySecret, map[string]string{
		"Action":     "DescribeDomainRecords",
		"DomainName": domain,
		"RRKeyWord":  rr,
		"Type":       recType,
		"PageSize":   "50",
	})
	if err != nil {
		return "", err
	}
	var parsed struct {
		DomainRecords struct {
			Record []struct {
				RecordID string `json:"RecordId"`
				RR       string `json:"RR"`
				Type     string `json:"Type"`
			} `json:"Record"`
		} `json:"DomainRecords"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	for _, rec := range parsed.DomainRecords.Record {
		if strings.EqualFold(rec.RR, rr) && strings.EqualFold(rec.Type, recType) {
			return rec.RecordID, nil
		}
	}
	return "", nil
}

func alidnsRPC(accessKeyID, accessKeySecret string, params map[string]string) ([]byte, error) {
	params = cloneStringMap(params)
	params["Format"] = "JSON"
	params["Version"] = "2015-01-09"
	params["AccessKeyId"] = accessKeyID
	params["SignatureMethod"] = "HMAC-SHA1"
	params["SignatureVersion"] = "1.0"
	params["SignatureNonce"] = fmt.Sprintf("%d", time.Now().UnixNano())
	params["Timestamp"] = time.Now().UTC().Format("2006-01-02T15:04:05Z")

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	canonical := make([]string, 0, len(keys))
	for _, k := range keys {
		canonical = append(canonical, alidnsPercentEncode(k)+"="+alidnsPercentEncode(params[k]))
	}
	stringToSign := "GET&" + alidnsPercentEncode("/") + "&" + alidnsPercentEncode(strings.Join(canonical, "&"))
	mac := hmac.New(sha1.New, []byte(accessKeySecret+"&"))
	_, _ = mac.Write([]byte(stringToSign))
	params["Signature"] = base64.StdEncoding.EncodeToString(mac.Sum(nil))

	q := url.Values{}
	for k, v := range params {
		q.Set(k, v)
	}
	endpoint := "https://alidns.aliyuncs.com/?" + q.Encode()
	resp, err := http.DefaultClient.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("alidns api %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var errCheck struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
	}
	_ = json.Unmarshal(body, &errCheck)
	if errCheck.Code != "" && !strings.EqualFold(errCheck.Code, "OK") {
		return nil, fmt.Errorf("alidns %s: %s", errCheck.Code, errCheck.Message)
	}
	return body, nil
}

func alidnsPercentEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}

func cloneStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in)+8)
	for k, v := range in {
		out[k] = v
	}
	return out
}

func quarantineInfectedFiles(infected []string) []map[string]string {
	moved := []map[string]string{}
	for _, raw := range infected {
		path := strings.TrimSpace(raw)
		if path == "" {
			continue
		}
		rel := path
		if strings.HasPrefix(path, filesRoot) {
			rel = strings.TrimPrefix(path, filesRoot)
			if !strings.HasPrefix(rel, "/") {
				rel = "/" + rel
			}
		} else if filepath.IsAbs(path) {
			relFrom, err := filepath.Rel(filesRoot, path)
			if err == nil && !strings.HasPrefix(relFrom, "..") {
				rel = "/" + filepath.ToSlash(relFrom)
			} else {
				continue
			}
		}
		out, err := handleFilesAdvanced("recycle", rel, "", "", "", "", 0, 0)
		if err != nil {
			continue
		}
		if m, ok := out.(map[string]any); ok {
			moved = append(moved, map[string]string{
				"path": path,
				"id":   strVal(m["id"]),
			})
		}
	}
	return moved
}

func parseTopPathsFromAccessLog(logPath string, limit int) []map[string]any {
	if limit <= 0 {
		limit = 10
	}
	b, err := os.ReadFile(logPath)
	if err != nil {
		return nil
	}
	lines := strings.Split(string(b), "\n")
	if len(lines) > 5000 {
		lines = lines[len(lines)-5000:]
	}
	counts := map[string]int{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		m := nginxAccessPathRe.FindStringSubmatch(line)
		if len(m) < 3 {
			continue
		}
		path := m[2]
		if idx := strings.Index(path, "?"); idx >= 0 {
			path = path[:idx]
		}
		counts[path]++
	}
	type kv struct {
		path  string
		count int
	}
	items := make([]kv, 0, len(counts))
	for p, c := range counts {
		items = append(items, kv{p, c})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].count == items[j].count {
			return items[i].path < items[j].path
		}
		return items[i].count > items[j].count
	})
	if len(items) > limit {
		items = items[:limit]
	}
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		out = append(out, map[string]any{"path": it.path, "count": it.count})
	}
	return out
}

func checkExposedWeakPaths() map[string]any {
	checks := []map[string]any{}
	paths := []struct {
		id    string
		path  string
		title string
	}{
		{"phpmyadmin_exposed", "/phpmyadmin", "phpMyAdmin path not denied in nginx"},
		{"adminer_exposed", "/adminer.php", "Adminer script reachable"},
		{"wp_config_backup", "/wp-config.php.bak", "WordPress config backup exposed"},
	}
	sitesDir := envOr("WEBINO_NGINX_SITES", "/etc/nginx/sites-available")
	entries, _ := os.ReadDir(sitesDir)
	for _, probe := range paths {
		exposed := false
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			content, err := os.ReadFile(filepath.Join(sitesDir, e.Name()))
			if err != nil {
				continue
			}
			s := string(content)
			if strings.Contains(s, probe.path) && !strings.Contains(s, "deny all") {
				exposed = true
				break
			}
		}
		checks = append(checks, map[string]any{
			"id": probe.id, "status": map[bool]string{true: "fail", false: "pass"}[exposed],
			"title": probe.title, "fixable": false,
		})
	}
	return map[string]any{"weak_paths": checks}
}

func exposedWeakPathChecks() []map[string]any {
	data := checkExposedWeakPaths()
	raw, _ := data["weak_paths"].([]map[string]any)
	return raw
}
