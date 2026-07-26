package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func handleFtpService(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	passive := readPassivePortRange()
	logPath := "/var/log/pure-ftpd/transfer.log"
	if _, err := os.Stat(logPath); err != nil {
		logPath = "/var/log/syslog"
	}
	data, _ := json.Marshal(map[string]any{
		"passive_port_range": passive,
		"control_port":       21,
		"log_source":         logPath,
		"note":               "Ensure passive ports are open in UFW/firewall for external FTP clients.",
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func readPassivePortRange() string {
	paths := []string{
		"/etc/pure-ftpd/conf/PassivePortRange",
		"/etc/pure-ftpd/conf/PassivePortRange.conf",
	}
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err == nil {
			return strings.TrimSpace(string(b))
		}
	}
	return "40000 40100"
}

func handleFtpAccountAction(w http.ResponseWriter, body map[string]any) bool {
	action := strVal(body["action"])
	username := strVal(body["username"])
	if username == "" {
		return false
	}
	if err := validateSafeName(username, 32); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return true
	}
	switch action {
	case "set_quota":
		quota := intVal(body["quota_mb"], 0)
		if quota < 0 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "quota_mb required"})
			return true
		}
		out, err := runArgv([]string{"pure-pw", "usermod", username, "-N", strconv.Itoa(quota)}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		_, _ = runArgv([]string{"pure-pw", "mkdb"}, "")
		data, _ := json.Marshal(map[string]any{"username": username, "quota_mb": quota, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "disable":
		out, err := runArgv([]string{"usermod", "-L", username}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"username": username, "enabled": "false", "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "enable":
		out, err := runArgv([]string{"usermod", "-U", username}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"username": username, "enabled": "true", "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "set_password":
		password := strVal(body["password"])
		if password == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "password required"})
			return true
		}
		if err := setPurePwPassword(username, password); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		_, _ = runArgv([]string{"pure-pw", "mkdb"}, "")
		data, _ := json.Marshal(map[string]string{"username": username, "updated": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	}
	return false
}

func handleDatabaseExtraActions(w http.ResponseWriter, body map[string]any) bool {
	action := strVal(body["action"])
	name := strVal(body["name"])
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	switch action {
	case "repair":
		if name == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
			return true
		}
		sql := fmt.Sprintf("REPAIR TABLE `%s`;", mysqlEscapeIdent(name))
		out, err := runArgv([]string{"mysql", "-e", sql}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"name": name, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "optimize":
		if name == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
			return true
		}
		sql := fmt.Sprintf("OPTIMIZE TABLE `%s`;", mysqlEscapeIdent(name))
		out, err := runArgv([]string{"mysql", "-e", sql}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"name": name, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "set_engine":
		if name == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
			return true
		}
		storage := strVal(body["storage_engine"])
		if storage == "" {
			storage = "InnoDB"
		}
		sql := fmt.Sprintf("ALTER TABLE `%s` ENGINE=%s;", mysqlEscapeIdent(name), storage)
		out, err := runArgv([]string{"mysql", "-e", sql}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"name": name, "engine": storage, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "set_root_password":
		password := strVal(body["password"])
		if password == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "password required"})
			return true
		}
		sql := fmt.Sprintf("ALTER USER 'root'@'localhost' IDENTIFIED BY '%s'; FLUSH PRIVILEGES;", mysqlEscapeUser(password))
		out, err := runArgv([]string{"mysql", "-e", sql}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(map[string]string{"updated": "true", "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	case "redis_info":
		if engine != "redis" {
			engine = "redis"
		}
		info, err := redisInfoPayload()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return true
		}
		data, _ := json.Marshal(info)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return true
	}
	return false
}

func listRedisDatabases() ([]map[string]any, error) {
	info, err := redisInfoPayload()
	if err != nil {
		return nil, err
	}
	memMB := intVal(info["memory_mb"], 0)
	return []map[string]any{{"name": "default", "engine": "redis", "size_mb": memMB, "ping": info["ping"]}}, nil
}

func handleDnsCloudflareProvider(w http.ResponseWriter, r *http.Request) {
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
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "zone_id required"})
			return
		}
		if action == "dns01" {
			recordName := strVal(body["record_name"])
			recordValue := strVal(body["record_value"])
			if err := cloudflareUpsertTxt(token, zoneID, recordName, recordValue); err != nil {
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
			if err := cloudflareUpsertRecord(token, zoneID, row); err == nil {
				synced++
			}
		}
		data, _ := json.Marshal(map[string]any{"synced": synced, "domain": strVal(body["domain"])})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func cloudflareUpsertTxt(token, zoneID, name, content string) error {
	return cloudflareUpsertRecord(token, zoneID, map[string]any{
		"type":    "TXT",
		"name":    name,
		"content": content,
	})
}

func cloudflareUpsertRecord(token, zoneID string, row map[string]any) error {
	payload := map[string]any{
		"type":    strVal(row["type"]),
		"name":    strVal(row["name"]),
		"content": strVal(row["content"]),
		"ttl":     120,
	}
	if proxied, ok := row["proxied"].(bool); ok {
		payload["proxied"] = proxied
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://api.cloudflare.com/client/v4/zones/"+zoneID+"/dns_records", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("cloudflare api %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func handleCronFailures(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	path := filepath.Join(webinaRoot, "var", "cron-failures.json")
	b, err := os.ReadFile(path)
	if err != nil {
		data, _ := json.Marshal(map[string]any{"failures": []any{}})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: b})
}
