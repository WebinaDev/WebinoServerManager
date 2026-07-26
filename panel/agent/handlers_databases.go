package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func handleDatabases(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleDatabasesList(w, r)
	case http.MethodPost:
		handleDatabasesPost(w, r)
	default:
		writeMethod(w)
	}
}

func handleDatabasesList(w http.ResponseWriter, r *http.Request) {
	engine := r.URL.Query().Get("engine")
	if engine == "" {
		engine = "mysql"
	}
	var dbs []map[string]any
	var err error
	switch engine {
	case "pgsql":
		dbs, err = listPgsqlDatabases()
	case "redis":
		dbs, err = listRedisDatabases()
	case "mongodb":
		dbs, err = listMongoDatabases()
	default:
		dbs, err = listMysqlDatabasesWithSize()
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]any{"databases": dbs, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabasesPost(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	action := strVal(body["action"])
	if action == "" {
		action = "create"
	}
	switch action {
	case "create":
		handleDatabaseCreate(w, body)
	case "delete_db":
		handleDatabaseDelete(w, body)
	case "export":
		handleDatabaseExport(w, body)
	case "import":
		handleDatabaseImport(w, body)
	case "size":
		handleDatabaseSize(w, body)
	default:
		if handleDatabaseExtraActions(w, body) {
			return
		}
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func handleDatabaseCreate(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	user := strVal(body["user"])
	password := strVal(body["password"])

	var out string
	var err error
	switch engine {
	case "pgsql":
		_, err = runArgv([]string{"createdb", name}, "")
		if err == nil && user != "" {
			sql := fmt.Sprintf("CREATE USER %s WITH PASSWORD '%s'; GRANT ALL PRIVILEGES ON DATABASE %s TO %s;",
				pgsqlQuoteIdent(user), strings.ReplaceAll(password, "'", "''"), pgsqlQuoteIdent(name), pgsqlQuoteIdent(user))
			_, err = runArgv([]string{"psql", "-c", sql}, "")
		}
	case "redis":
		_, err = runArgv([]string{"redis-cli", "ping"}, "")
	case "mongodb":
		err = mongoCreateDatabase(name)
	default:
		sql := "CREATE DATABASE IF NOT EXISTS `" + mysqlEscapeIdent(name) + "`;"
		if user != "" {
			host := strVal(body["host"])
			if host == "" {
				host = "localhost"
			}
			sql += fmt.Sprintf(" CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s';",
				mysqlEscapeUser(user), mysqlEscapeUser(host), mysqlEscapeUser(password))
			sql += fmt.Sprintf(" GRANT ALL ON `%s`.* TO '%s'@'%s'; FLUSH PRIVILEGES;",
				mysqlEscapeIdent(name), mysqlEscapeUser(user), mysqlEscapeUser(host))
		}
		out, err = runArgv([]string{"mysql", "-e", sql}, "")
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out, "name": name, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseDelete(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	var err error
	switch engine {
	case "pgsql":
		_, err = runArgv([]string{"dropdb", "--if-exists", name}, "")
	case "mongodb":
		err = mongoDropDatabase(name)
	default:
		_, err = runArgv([]string{"mysql", "-e", "DROP DATABASE IF EXISTS `" + mysqlEscapeIdent(name) + "`;"}, "")
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"name": name, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseExport(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	ts := time.Now().Format("20060102-150405")
	var filename string
	var err error
	switch engine {
	case "pgsql":
		filename = fmt.Sprintf("pg-%s-%s.sql.gz", name, ts)
		dest := filepath.Join(backupDir, filename)
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("pg_dump %s | gzip > %s", shellQuote(name), shellQuote(dest))}, "")
	default:
		filename = fmt.Sprintf("db-%s-%s.sql.gz", name, ts)
		dest := filepath.Join(backupDir, filename)
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("mysqldump %s | gzip > %s", shellQuote(name), shellQuote(dest))}, "")
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"filename": filename, "name": name, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseImport(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	file := strVal(body["file"])
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	if name == "" || file == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name and file required"})
		return
	}
	path, err := safeFilePath(filepath.Join("backups", file))
	if err != nil {
		path, err = safeFilePath(file)
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	switch engine {
	case "pgsql":
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("gunzip -c %s | psql %s", shellQuote(path), shellQuote(name))}, "")
	default:
		_, err = runArgv([]string{"sh", "-c", fmt.Sprintf("gunzip -c %s | mysql %s", shellQuote(path), shellQuote(name))}, "")
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"name": name, "file": file, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseSize(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	engine := strVal(body["engine"])
	if engine == "" {
		engine = "mysql"
	}
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	size, err := databaseSizeMB(name, engine)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]any{"name": name, "engine": engine, "size_mb": size})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		users, err := listMysqlUsers()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"users": users})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		handleDatabaseUserAction(w, body)
	default:
		writeMethod(w)
	}
}

func handleDatabaseUserAction(w http.ResponseWriter, body map[string]any) {
	action := strVal(body["action"])
	user := strVal(body["user"])
	host := strVal(body["host"])
	if host == "" {
		host = "localhost"
	}
	dbName := strVal(body["database"])
	password := strVal(body["password"])

	var sql string
	switch action {
	case "create_user":
		if user == "" || password == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "user and password required"})
			return
		}
		sql = fmt.Sprintf("CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s'; FLUSH PRIVILEGES;",
			mysqlEscapeUser(user), mysqlEscapeUser(host), mysqlEscapeUser(password))
	case "drop_user":
		if user == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "user required"})
			return
		}
		sql = fmt.Sprintf("DROP USER IF EXISTS '%s'@'%s'; FLUSH PRIVILEGES;",
			mysqlEscapeUser(user), mysqlEscapeUser(host))
	case "passwd_user":
		if user == "" || password == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "user and password required"})
			return
		}
		sql = fmt.Sprintf("ALTER USER '%s'@'%s' IDENTIFIED BY '%s'; FLUSH PRIVILEGES;",
			mysqlEscapeUser(user), mysqlEscapeUser(host), mysqlEscapeUser(password))
	case "grant":
		if user == "" || dbName == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "user and database required"})
			return
		}
		sql = fmt.Sprintf("GRANT ALL ON `%s`.* TO '%s'@'%s'; FLUSH PRIVILEGES;",
			mysqlEscapeIdent(dbName), mysqlEscapeUser(user), mysqlEscapeUser(host))
	case "revoke":
		if user == "" || dbName == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "user and database required"})
			return
		}
		sql = fmt.Sprintf("REVOKE ALL ON `%s`.* FROM '%s'@'%s'; FLUSH PRIVILEGES;",
			mysqlEscapeIdent(dbName), mysqlEscapeUser(user), mysqlEscapeUser(host))
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		return
	}
	_, err := runArgv([]string{"mysql", "-e", sql}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"user": user, "host": host, "action": action})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func listMysqlDatabasesWithSize() ([]map[string]any, error) {
	names, err := listMysqlDatabases()
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(names))
	for _, row := range names {
		name := row["name"]
		size, _ := databaseSizeMB(name, "mysql")
		out = append(out, map[string]any{"name": name, "size_mb": size, "engine": "mysql"})
	}
	return out, nil
}

func listPgsqlDatabases() ([]map[string]any, error) {
	out, err := runArgv([]string{"psql", "-At", "-c", "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres'"}, "")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	result := make([]map[string]any, 0)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		size, _ := databaseSizeMB(line, "pgsql")
		result = append(result, map[string]any{"name": line, "size_mb": size, "engine": "pgsql"})
	}
	return result, nil
}

func listMysqlUsers() ([]map[string]string, error) {
	out, err := runArgv([]string{"mysql", "-N", "-e", "SELECT User, Host FROM mysql.user WHERE User != '' ORDER BY User, Host"}, "")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	users := make([]map[string]string, 0)
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			users = append(users, map[string]string{"user": parts[0], "host": parts[1]})
		}
	}
	return users, nil
}

func databaseSizeMB(name, engine string) (int, error) {
	switch engine {
	case "pgsql":
		out, err := runArgv([]string{"psql", "-At", "-c", fmt.Sprintf("SELECT pg_database_size('%s')/1024/1024", strings.ReplaceAll(name, "'", "''"))}, "")
		if err != nil {
			return 0, err
		}
		var size int
		fmt.Sscanf(strings.TrimSpace(out), "%d", &size)
		return size, nil
	default:
		sql := fmt.Sprintf("SELECT ROUND(SUM(data_length+index_length)/1024/1024) FROM information_schema.tables WHERE table_schema='%s'",
			strings.ReplaceAll(name, "'", "''"))
		out, err := runArgv([]string{"mysql", "-N", "-e", sql}, "")
		if err != nil {
			return 0, err
		}
		var size int
		fmt.Sscanf(strings.TrimSpace(out), "%d", &size)
		return size, nil
	}
}

func mysqlEscapeIdent(s string) string {
	return strings.ReplaceAll(s, "`", "``")
}

func mysqlEscapeUser(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

func buildGrantSQL(db, user, host string) string {
	return fmt.Sprintf("GRANT ALL ON `%s`.* TO '%s'@'%s'; FLUSH PRIVILEGES;",
		mysqlEscapeIdent(db), mysqlEscapeUser(user), mysqlEscapeUser(host))
}

func pgsqlQuoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

const remoteAccessConfigPath = "/var/lib/webina/database-remote-access.json"

type remoteAccessConfig struct {
	Enabled    bool     `json:"enabled"`
	AllowedIPs []string `json:"allowed_ips"`
	UfwRules   []string `json:"ufw_rules,omitempty"`
}

func handleDatabaseRemoteAccess(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleDatabaseRemoteAccessGet(w)
	case http.MethodPost:
		handleDatabaseRemoteAccessPost(w, r)
	default:
		writeMethod(w)
	}
}

func handleDatabaseRemoteAccessGet(w http.ResponseWriter) {
	cfg := loadRemoteAccessConfig()
	data, _ := json.Marshal(map[string]any{
		"enabled":     cfg.Enabled,
		"allowed_ips": cfg.AllowedIPs,
		"host":        detectServerHost(),
		"mysql_port":  3306,
		"pgsql_port":  5432,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDatabaseRemoteAccessPost(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled    bool     `json:"enabled"`
		AllowedIPs []string `json:"allowed_ips"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}

	cleaned := make([]string, 0, len(body.AllowedIPs))
	seen := map[string]bool{}
	for _, ip := range body.AllowedIPs {
		ip = strings.TrimSpace(ip)
		if ip == "" || seen[ip] {
			continue
		}
		if err := validateRemoteAccessIP(ip); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		seen[ip] = true
		cleaned = append(cleaned, ip)
	}

	if body.Enabled && len(cleaned) == 0 {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "allowed_ips required when enabled"})
		return
	}

	cfg := loadRemoteAccessConfig()
	if err := clearRemoteAccessUfwRules(cfg.UfwRules); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}

	cfg.Enabled = body.Enabled
	cfg.AllowedIPs = cleaned
	cfg.UfwRules = nil

	if body.Enabled {
		rules, err := applyRemoteAccessUfwRules(cleaned)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		cfg.UfwRules = rules
	}

	if err := saveRemoteAccessConfig(cfg); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}

	data, _ := json.Marshal(map[string]any{
		"enabled":     cfg.Enabled,
		"allowed_ips": cfg.AllowedIPs,
		"host":        detectServerHost(),
		"mysql_port":  3306,
		"pgsql_port":  5432,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func loadRemoteAccessConfig() remoteAccessConfig {
	b, err := os.ReadFile(remoteAccessConfigPath)
	if err != nil {
		return remoteAccessConfig{AllowedIPs: []string{}}
	}
	var cfg remoteAccessConfig
	if json.Unmarshal(b, &cfg) != nil {
		return remoteAccessConfig{AllowedIPs: []string{}}
	}
	if cfg.AllowedIPs == nil {
		cfg.AllowedIPs = []string{}
	}
	return cfg
}

func saveRemoteAccessConfig(cfg remoteAccessConfig) error {
	if err := os.MkdirAll(filepath.Dir(remoteAccessConfigPath), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(remoteAccessConfigPath, b, 0o644)
}

func detectServerHost() string {
	out, err := runArgv([]string{"hostname", "-I"}, "")
	if err == nil {
		for _, ip := range strings.Fields(out) {
			if !strings.HasPrefix(ip, "127.") && !strings.HasPrefix(ip, "169.254.") {
				return ip
			}
		}
	}
	hostname, _ := os.Hostname()
	return hostname
}

func validateRemoteAccessIP(ip string) error {
	if strings.Contains(ip, "/") {
		_, _, err := net.ParseCIDR(ip)
		if err != nil {
			return fmt.Errorf("invalid cidr: %s", ip)
		}
		return nil
	}
	if net.ParseIP(ip) == nil {
		return fmt.Errorf("invalid ip: %s", ip)
	}
	return nil
}

func applyRemoteAccessUfwRules(ips []string) ([]string, error) {
	rules := make([]string, 0, len(ips)*2)
	for _, ip := range ips {
		for _, port := range []string{"3306", "5432"} {
			rule := fmt.Sprintf("allow from %s to any port %s proto tcp", ip, port)
			if _, err := runArgv(append([]string{"ufw"}, strings.Fields(rule)...), ""); err != nil {
				return rules, err
			}
			rules = append(rules, rule)
		}
	}
	return rules, nil
}

func clearRemoteAccessUfwRules(rules []string) error {
	for _, rule := range rules {
		parts := strings.Fields(rule)
		if len(parts) == 0 {
			continue
		}
		argv := append([]string{"ufw", "--force", "delete"}, parts...)
		_, _ = runArgv(argv, "")
	}
	return nil
}
