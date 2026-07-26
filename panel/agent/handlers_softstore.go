package main

import (
	"encoding/json"
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
	"cms_composer_stub":       true,
	"install_wordpress_cms":   true,
	"compose_up_redis":        true,
	"compose_up_nginx":        true,
	"install_node_nvm":        true,
	"install_node_nodesource": true,
	"install_python_distro":   true,
	"install_go_distro":         true,
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
	default:
		detail = "unknown package"
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
	var body struct {
		ScriptID string         `json:"script_id"`
		Options  map[string]any `json:"options"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if !softstoreScriptIDs[body.ScriptID] {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "script_id not allowlisted"})
		return
	}
	if body.Options == nil {
		body.Options = map[string]any{}
	}
	logOut, err := runSoftstoreScript(body.ScriptID, body.Options)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + logOut})
		return
	}
	data, _ := json.Marshal(map[string]string{"script_id": body.ScriptID, "log": logOut})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
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
	case "cms_composer_stub":
		docRoot := strVal(options["document_root"])
		if docRoot == "" {
			return "", errSoftstore("document_root required for cms_composer_stub")
		}
		absRoot, err := safeFilePath(docRoot)
		if err != nil {
			return "", err
		}
		return runArgv([]string{"composer", "install", "--no-interaction", "--working-dir=" + absRoot}, "")
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
	case "install_node_nvm", "install_node_nodesource", "install_python_distro", "install_go_distro":
		return runRuntimesInstallScript(scriptID)
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

type softstoreError string

func (e softstoreError) Error() string { return string(e) }

func errSoftstore(msg string) error { return softstoreError(msg) }
