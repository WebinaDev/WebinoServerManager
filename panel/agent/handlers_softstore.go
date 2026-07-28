package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Allowlisted Softstore install scripts — no user-supplied shell.
var softstoreScriptIDs = map[string]bool{
	"install_redis":           true,
	"install_memcached":       true,
	"ensure_composer":         true,
	"install_wordpress_cms":   true,
	"compose_up_redis":        true,
	"compose_up_nginx":        true,
	"install_node_nvm":        true,
	"install_node_nodesource": true,
	"install_python_distro":   true,
	"install_go_distro":       true,
	"install_java_distro":     true,
	"install_nginx":           true,
	"install_apache":          true,
	"install_mariadb":         true,
	"install_mysql":           true,
	"install_php_fpm_81":      true,
	"install_php_fpm_82":      true,
	"install_php_fpm_83":      true,
	"install_php_fpm_84":      true,
	"install_pureftpd":        true,
	"ensure_ufw_baseline":     true,
	"ensure_fail2ban":         true,
}

func handleSoftstoreStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	raw := r.URL.Query().Get("packages")
	names := []string{}
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(strings.ToLower(p))
		if p != "" {
			names = append(names, p)
		}
	}
	if len(names) == 0 {
		names = []string{"redis", "memcached", "composer"}
	}
	out := map[string]any{}
	for _, name := range names {
		out[name] = probeSoftstorePackage(name)
	}
	data, _ := json.Marshal(map[string]any{"packages": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func probeSoftstorePackage(name string) map[string]any {
	installed := false
	detail := ""
	switch name {
	case "redis":
		installed, detail = softstoreProbeBins("redis-server", "redis-cli")
		if !installed {
			installed = softstoreSystemdActive("redis-server") || softstoreSystemdActive("redis")
		}
	case "memcached":
		installed, detail = softstoreProbeBins("memcached")
		if !installed {
			installed = softstoreSystemdActive("memcached")
		}
	case "composer":
		installed, detail = softstoreProbeBins("composer")
	case "docker-redis":
		installed = softstoreComposeProjectExists("softstore-redis")
		detail = "compose project softstore-redis"
	case "docker-nginx":
		installed = softstoreComposeProjectExists("softstore-nginx")
		detail = "compose project softstore-nginx"
	case "node-nvm", "node":
		installed, detail = softstoreProbeBins("node")
		if !installed {
			out, err := softstoreBash(`export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && command -v node`)
			out = strings.TrimSpace(out)
			if err == nil && out != "" {
				installed, detail = true, out+" (nvm)"
			}
		}
	case "python-distro", "python":
		installed, detail = softstoreProbeBins("python3")
	case "go-distro", "go":
		installed, detail = softstoreProbeBins("go")
	case "java-distro", "java":
		installed, detail = softstoreProbeBins("java")
	case "wordpress-cms":
		detail = "install via website document root (wp-cli)"
		if root := os.Getenv("WEBINO_FILES_ROOT"); root != "" {
			// Best-effort: any wp-config under files root counts as present for catalog status.
			if matches, _ := filepath.Glob(filepath.Join(root, "*", "wp-config.php")); len(matches) > 0 {
				installed, detail = true, matches[0]
			} else if matches, _ := filepath.Glob(filepath.Join(root, "*", "*", "wp-config.php")); len(matches) > 0 {
				installed, detail = true, matches[0]
			}
		}
	default:
		if installed2, detail2, ok := probeSoftstoreStackPackage(name); ok {
			installed, detail = installed2, detail2
		} else {
			detail = "unknown package"
		}
	}
	status := "available"
	if installed {
		status = "installed"
	}
	return map[string]any{"status": status, "detail": detail}
}

func softstoreProbeBins(bins ...string) (bool, string) {
	for _, b := range bins {
		path, err := softstoreHostLookPath(b)
		if err == nil {
			return true, path
		}
	}
	return false, ""
}

func softstoreSystemdActive(unit string) bool {
	out, err := runArgvEnv(softstoreHostArgv([]string{"systemctl", "is-active", unit}), nil)
	return err == nil && strings.TrimSpace(out) == "active"
}

func handleSoftstoreInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	var body struct {
		ScriptID string          `json:"script_id"`
		Options  json.RawMessage `json:"options"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if !softstoreScriptIDs[body.ScriptID] {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "script_id not allowlisted"})
		return
	}
	opts := softstoreNormalizeOptions(body.Options)
	logOut, err := runSoftstoreScript(body.ScriptID, opts)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + logOut})
		return
	}
	data, _ := json.Marshal(map[string]string{"script_id": body.ScriptID, "log": logOut})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleSoftstoreUninstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	var body struct {
		ScriptID string          `json:"script_id"`
		Options  json.RawMessage `json:"options"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if !softstoreScriptIDs[body.ScriptID] {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "script_id not allowlisted"})
		return
	}
	opts := softstoreNormalizeOptions(body.Options)
	logOut, err := runSoftstoreUninstall(body.ScriptID, opts)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + logOut})
		return
	}
	data, _ := json.Marshal(map[string]string{"script_id": body.ScriptID, "log": logOut, "action": "uninstall"})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

// softstoreNormalizeOptions accepts {}, [], null, or omitted options.
func softstoreNormalizeOptions(raw json.RawMessage) map[string]any {
	if len(raw) == 0 || string(raw) == "null" {
		return map[string]any{}
	}
	var asMap map[string]any
	if err := json.Unmarshal(raw, &asMap); err == nil && asMap != nil {
		return asMap
	}
	// Tolerate JSON arrays (PHP empty slice encodes as [])
	var asArr []any
	if err := json.Unmarshal(raw, &asArr); err == nil {
		return map[string]any{}
	}
	return map[string]any{}
}

func runSoftstoreScript(scriptID string, options map[string]any) (string, error) {
	switch scriptID {
	case "install_redis":
		return softstoreInstallRedis()
	case "install_memcached":
		return softstoreInstallMemcached()
	case "ensure_composer":
		return softstoreEnsureComposer()
	case "install_wordpress_cms":
		return softstoreInstallWordPressCMS(options)
	case "compose_up_redis":
		return runSoftstoreComposeUp("compose_up_redis", "softstore-redis")
	case "compose_up_nginx":
		return runSoftstoreComposeUp("compose_up_nginx", "softstore-nginx")
	case "install_node_nvm", "install_node_nodesource", "install_python_distro", "install_go_distro", "install_java_distro":
		return runRuntimesInstallScript(scriptID)
	case "install_nginx", "install_apache", "install_mariadb", "install_mysql",
		"install_php_fpm_81", "install_php_fpm_82", "install_php_fpm_83", "install_php_fpm_84",
		"install_pureftpd", "ensure_ufw_baseline", "ensure_fail2ban":
		return runSoftstoreStackScript(scriptID)
	default:
		return "", errSoftstore("unknown script")
	}
}

func softstoreInstallWordPressCMS(options map[string]any) (string, error) {
	docRoot := strVal(options["document_root"])
	domain := strVal(options["domain"])
	if docRoot == "" {
		return "", errSoftstore("document_root required for install_wordpress_cms (pick a website)")
	}
	absRoot, err := safeFilePath(docRoot)
	if err != nil {
		return "", err
	}
	_ = os.MkdirAll(absRoot, 0o755)
	if _, err := os.Stat(filepath.Join(absRoot, "wp-config.php")); err == nil {
		return "WordPress already installed in " + absRoot, nil
	}
	wpBin := "wp"
	if path, err := exec.LookPath("wp"); err == nil {
		wpBin = path
	} else if path, err := softstoreHostLookPath("wp"); err == nil {
		wpBin = path
	} else {
		return "", errSoftstore("wp-cli (wp) not found; rebuild panel-agent image")
	}
	out, err := runArgv([]string{wpBin, "core", "download", "--path=" + absRoot}, "")
	if err != nil {
		return out, err
	}
	dbName := strVal(options["db_name"])
	dbUser := strVal(options["db_user"])
	dbPass := strVal(options["db_password"])
	dbHost := strVal(options["db_host"])
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	title := strVal(options["title"])
	adminUser := strVal(options["admin_user"])
	adminPass := strVal(options["admin_password"])
	adminEmail := strVal(options["admin_email"])
	if domain == "" || dbUser == "" || adminUser == "" || adminPass == "" || adminEmail == "" {
		return out + "\nWordPress core downloaded to " + absRoot +
			". Complete DB/admin setup in WordPress toolkit (/wordpress) or re-run with domain, db_*, admin_* options.", nil
	}
	if dbName == "" {
		dbName = strings.ReplaceAll(domain, ".", "_")
	}
	if title == "" {
		title = domain
	}
	cfgOut, cfgErr := runArgv([]string{
		wpBin, "config", "create",
		"--path=" + absRoot,
		"--dbname=" + dbName,
		"--dbuser=" + dbUser,
		"--dbpass=" + dbPass,
		"--dbhost=" + dbHost,
		"--skip-check",
	}, "")
	out = out + "\n" + cfgOut
	if cfgErr != nil {
		return out, cfgErr
	}
	instOut, instErr := runArgv([]string{
		wpBin, "core", "install",
		"--path=" + absRoot,
		"--url=https://" + domain,
		"--title=" + title,
		"--admin_user=" + adminUser,
		"--admin_password=" + adminPass,
		"--admin_email=" + adminEmail,
		"--skip-email",
	}, "")
	out = out + "\n" + instOut
	return out, instErr
}

func softstoreComposeProjectExists(project string) bool {
	dir, err := jailComposeProjectDir(project)
	if err != nil {
		return false
	}
	_, err = os.Stat(filepath.Join(dir, "docker-compose.yml"))
	return err == nil
}

func runSoftstoreUninstall(scriptID string, options map[string]any) (string, error) {
	switch scriptID {
	case "install_redis":
		return softstoreAptRemove("redis-server", "redis")
	case "install_memcached":
		return softstoreAptRemove("memcached")
	case "ensure_composer":
		out, err := softstoreAptRemove("composer")
		_, _ = softstoreBash("rm -f /usr/local/bin/composer")
		return out, err
	case "compose_up_redis":
		return runSoftstoreComposeDown("softstore-redis")
	case "compose_up_nginx":
		return runSoftstoreComposeDown("softstore-nginx")
	case "install_nginx":
		return softstoreAptRemove("nginx")
	case "install_apache":
		return softstoreAptRemove("apache2")
	case "install_mariadb":
		return softstoreAptRemove("mariadb-server", "default-mysql-server", "mysql-server")
	case "install_mysql":
		return softstoreAptRemove("mysql-server", "default-mysql-server", "mariadb-server")
	case "install_php_fpm_81":
		return softstoreAptRemove("php8.1-fpm")
	case "install_php_fpm_82":
		return softstoreAptRemove("php8.2-fpm")
	case "install_php_fpm_83":
		return softstoreAptRemove("php8.3-fpm")
	case "install_php_fpm_84":
		return softstoreAptRemove("php8.4-fpm")
	case "install_pureftpd":
		return softstoreAptRemove("pure-ftpd")
	case "install_wordpress_cms":
		return "WordPress CMS uninstall is manual via Files / Website hub", nil
	case "install_node_nvm", "install_node_nodesource", "install_python_distro", "install_go_distro", "install_java_distro":
		return "Runtime uninstall is managed via distro packages; use system package manager if needed", nil
	case "ensure_ufw_baseline", "ensure_fail2ban":
		return "Security baseline packages are not auto-removed", nil
	default:
		_ = options
		return "", errSoftstore("uninstall not supported for script")
	}
}

func softstoreAptRemove(pkgs ...string) (string, error) {
	argv := append([]string{"apt-get", "remove", "-y"}, pkgs...)
	return softstoreAptRun(argv)
}

func runSoftstoreComposeDown(project string) (string, error) {
	if !validContainerName(project) {
		return "", errSoftstore("invalid project name")
	}
	dir, err := jailComposeProjectDir(project)
	if err != nil {
		return "", err
	}
	composePath := filepath.Join(dir, "docker-compose.yml")
	out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "down", "-v"}, dir)
	if err != nil {
		return out, err
	}
	return "project=" + project + "\n" + out, nil
}

type softstoreError string

func (e softstoreError) Error() string { return string(e) }

func errSoftstore(msg string) error { return softstoreError(msg) }
