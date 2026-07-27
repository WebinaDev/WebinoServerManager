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
	case "python-distro", "python":
		installed, detail = softstoreProbeBins("python3")
	case "go-distro", "go":
		installed, detail = softstoreProbeBins("go")
	case "java-distro", "java":
		installed, detail = softstoreProbeBins("java")
	case "wordpress-cms":
		detail = "install via website document root"
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
		path, err := exec.LookPath(b)
		if err == nil {
			return true, path
		}
	}
	return false, ""
}

func softstoreSystemdActive(unit string) bool {
	out, err := runArgv([]string{"systemctl", "is-active", unit}, "")
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
		return runArgv([]string{"apt-get", "install", "-y", "redis-server"}, "")
	case "install_memcached":
		return runArgv([]string{"apt-get", "install", "-y", "memcached"}, "")
	case "ensure_composer":
		if path, err := exec.LookPath("composer"); err == nil {
			return "composer already present: " + path, nil
		}
		return runArgv([]string{"apt-get", "install", "-y", "composer"}, "")
	case "install_wordpress_cms":
		docRoot := strVal(options["document_root"])
		domain := strVal(options["domain"])
		if docRoot == "" {
			return "", errSoftstore("document_root required for install_wordpress_cms")
		}
		absRoot, err := safeFilePath(docRoot)
		if err != nil {
			return "", err
		}
		_ = os.MkdirAll(absRoot, 0o755)
		if _, err := os.Stat(filepath.Join(absRoot, "wp-config.php")); err == nil {
			return "WordPress already installed in " + absRoot, nil
		}
		webina := filepath.Join(webinaRoot, "bin", "webina")
		argv := []string{webina, "wordpress", "install", "--path", absRoot}
		if domain != "" {
			argv = append(argv, "--domain", domain)
		}
		return runArgv(argv, webinaRoot)
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
		return runArgv([]string{"apt-get", "remove", "-y", "redis-server"}, "")
	case "install_memcached":
		return runArgv([]string{"apt-get", "remove", "-y", "memcached"}, "")
	case "ensure_composer":
		return runArgv([]string{"apt-get", "remove", "-y", "composer"}, "")
	case "compose_up_redis":
		return runSoftstoreComposeDown("softstore-redis")
	case "compose_up_nginx":
		return runSoftstoreComposeDown("softstore-nginx")
	case "install_nginx":
		return runArgv([]string{"apt-get", "remove", "-y", "nginx"}, "")
	case "install_apache":
		return runArgv([]string{"apt-get", "remove", "-y", "apache2"}, "")
	case "install_mariadb":
		return runArgv([]string{"apt-get", "remove", "-y", "mariadb-server"}, "")
	case "install_mysql":
		return runArgv([]string{"apt-get", "remove", "-y", "mysql-server"}, "")
	case "install_php_fpm_81":
		return runArgv([]string{"apt-get", "remove", "-y", "php8.1-fpm"}, "")
	case "install_php_fpm_82":
		return runArgv([]string{"apt-get", "remove", "-y", "php8.2-fpm"}, "")
	case "install_php_fpm_83":
		return runArgv([]string{"apt-get", "remove", "-y", "php8.3-fpm"}, "")
	case "install_php_fpm_84":
		return runArgv([]string{"apt-get", "remove", "-y", "php8.4-fpm"}, "")
	case "install_pureftpd":
		return runArgv([]string{"apt-get", "remove", "-y", "pure-ftpd"}, "")
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
