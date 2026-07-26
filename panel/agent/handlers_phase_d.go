package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
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
		"ping":           "PONG",
		"memory_bytes":   memUsed,
		"memory_mb":      memUsed / (1024 * 1024),
		"info_memory":    infoOut,
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
	case "sync_records", "dns01":
		if token == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "api_token required"})
			return
		}
		if zoneID == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "zone_id required for AliDNS"})
			return
		}
		// MVP stub: validate token shape and acknowledge — full Aliyun API in later wave.
		if len(token) < 8 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid api_token"})
			return
		}
		data, _ := json.Marshal(map[string]any{
			"provider": "alidns",
			"zone_id":  zoneID,
			"action":   action,
			"status":   "queued",
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
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
