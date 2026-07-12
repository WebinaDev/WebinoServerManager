package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type nginxVhostOpts struct {
	Fqdn        string
	Root        string
	PhpPool     string
	PhpVersion  string
	Ssl         bool
	ForceHTTPS  bool
	Hsts        bool
	Redirects   []map[string]string
	ProxyPass   string
	Htpasswd    string
	ErrorPages     map[string]string
	HotlinkProtect bool
}

func handleVhosts(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		vhosts, err := listNginxVhosts()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"vhosts": vhosts})
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
	name := strVal(body["name"])
	if name == "" {
		name = strings.ReplaceAll(strings.ToLower(strVal(body["fqdn"])), ".", "_")
	}
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name or fqdn required"})
		return
	}
	if err := validateSafeName(name, 128); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	content := strVal(body["content"])
	if content != "" {
		if envOr("WEBINO_ALLOW_RAW_VHOST", "") != "true" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "raw vhost content disabled"})
			return
		}
		if len(content) > 65536 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "vhost content too large"})
			return
		}
	} else {
		opts := nginxVhostOpts{
			Fqdn:       strVal(body["fqdn"]),
			Root:       strVal(body["document_root"]),
			PhpPool:    strVal(body["php_pool"]),
			PhpVersion: strVal(body["php_version"]),
			Ssl:        body["ssl"] == true,
			ForceHTTPS: body["force_https"] == true,
			Hsts:       body["hsts"] == true,
			ProxyPass:  strVal(body["proxy_pass"]),
		}
		if opts.Fqdn == "" {
			opts.Fqdn = strings.ReplaceAll(name, "_", ".")
		}
		if opts.Root == "" {
			opts.Root = filepath.Join("sites", opts.Fqdn, "public")
		}
		absRoot, err := safeFilePath(opts.Root)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		_ = os.MkdirAll(absRoot, 0o755)
		opts.Root = absRoot
		content = buildNginxVhost(opts)
	}
	if err := writeNginxVhost(name, content); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	confPath, _ := vhostConfPath(name)
	data, _ := json.Marshal(map[string]string{"name": name, "config": confPath})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleVhostByName(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/v1/vhosts/")
	name = strings.Trim(name, "/")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name required"})
		return
	}
	sub := strings.Split(name, "/")
	vhostName := sub[0]
	if err := validateSafeName(vhostName, 128); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	action := ""
	if len(sub) > 1 {
		action = sub[1]
	}

	if r.Method == http.MethodGet && action == "" {
		content, err := readNginxVhost(vhostName)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"name": vhostName, "content": content})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method == http.MethodDelete && action == "" {
		if err := deleteNginxVhost(vhostName); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"name": vhostName, "deleted": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method == http.MethodPost && action != "" {
		handleVhostAction(w, r, vhostName, action)
		return
	}
	writeMethod(w)
}

func handleVhostAction(w http.ResponseWriter, r *http.Request, name, action string) {
	var body map[string]any
	_ = json.NewDecoder(r.Body).Decode(&body)
	content, err := readNginxVhost(name)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	switch action {
	case "redirects":
		from := strVal(body["from"])
		to := strVal(body["to"])
		code := strVal(body["code"])
		if code == "" {
			code = "301"
		}
		block := fmt.Sprintf("\n    location %s { return %s %s; }\n", from, code, to)
		content += block
	case "proxy":
		target := strVal(body["target"])
		block := fmt.Sprintf(`
    location / {
        proxy_pass %s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
`, target)
		content += block
	case "htpasswd":
		user := strVal(body["user"])
		pass := strVal(body["password"])
		path := strVal(body["path"])
		if path == "" {
			path = "/"
		}
		htfile := filepath.Join(nginxSitesDir, name+".htpasswd")
		_, _ = runArgv([]string{"htpasswd", "-cb", htfile, user, pass}, "")
		block := fmt.Sprintf(`
    location %s {
        auth_basic "Restricted";
        auth_basic_user_file %s;
    }
`, path, htfile)
		content += block
	case "ssl":
		fqdn := strings.ReplaceAll(name, "_", ".")
		_, _ = runArgv([]string{"certbot", "certonly", "--nginx", "-d", fqdn, "--non-interactive", "--agree-tos", "-m", "admin@" + fqdn}, "")
		content = strings.Replace(content, "listen 80;", "listen 80;\n    listen 443 ssl http2;", 1)
		content += fmt.Sprintf("\n    ssl_certificate /etc/letsencrypt/live/%s/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/%s/privkey.pem;\n", fqdn, fqdn)
	case "hsts":
		content += "\n    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n"
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		return
	}
	if err := writeNginxVhost(name, content); err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"name": name, "action": action})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func buildNginxVhost(opts nginxVhostOpts) string {
	var b strings.Builder
	b.WriteString("server {\n")
	b.WriteString("    listen 80;\n")
	if opts.Ssl {
		b.WriteString("    listen 443 ssl http2;\n")
		fqdn := opts.Fqdn
		b.WriteString(fmt.Sprintf("    ssl_certificate /etc/letsencrypt/live/%s/fullchain.pem;\n", fqdn))
		b.WriteString(fmt.Sprintf("    ssl_certificate_key /etc/letsencrypt/live/%s/privkey.pem;\n", fqdn))
	}
	b.WriteString(fmt.Sprintf("    server_name %s;\n", opts.Fqdn))
	b.WriteString(fmt.Sprintf("    root %s;\n", opts.Root))
	b.WriteString("    index index.html index.php;\n")
	if opts.ForceHTTPS {
		b.WriteString("    if ($scheme = http) { return 301 https://$host$request_uri; }\n")
	}
	if opts.Hsts {
		b.WriteString("    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n")
	}
	if opts.ProxyPass != "" {
		b.WriteString(fmt.Sprintf(`
    location / {
        proxy_pass %s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
`, opts.ProxyPass))
	} else {
		b.WriteString("    location / { try_files $uri $uri/ =404; }\n")
	}
	if opts.PhpPool != "" {
		ver := opts.PhpVersion
		if ver == "" {
			ver = "8.2"
		}
		sock := fmt.Sprintf("unix:/run/php/php%s-fpm-%s.sock", ver, opts.PhpPool)
		b.WriteString(fmt.Sprintf(`
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass %s;
    }
`, sock))
	}
	for code, path := range opts.ErrorPages {
		b.WriteString(fmt.Sprintf("    error_page %s %s;\n", code, path))
	}
	if opts.HotlinkProtect {
		b.WriteString(`    location ~* \.(gif|jpg|jpeg|png|webp)$ {
        valid_referers none blocked server_names ~.;
        if ($invalid_referer) { return 403; }
    }
`)
	}
	b.WriteString("}\n")
	return b.String()
}

func vhostConfPath(name string) (string, error) {
	if err := validateSafeName(name, 64); err != nil {
		return "", err
	}
	confPath := filepath.Join(nginxSitesDir, name+".conf")
	return jailPathUnder(nginxSitesDir, confPath)
}

func writeNginxVhost(name, content string) error {
	_ = os.MkdirAll(nginxSitesDir, 0o755)
	_ = os.MkdirAll(nginxEnabled, 0o755)
	confPath, err := vhostConfPath(name)
	if err != nil {
		return err
	}
	enabledPath := filepath.Join(nginxEnabled, name+".conf")
	if err := os.WriteFile(confPath, []byte(content), 0o644); err != nil {
		return err
	}
	_ = os.Remove(enabledPath)
	_ = os.Symlink(confPath, enabledPath)
	if _, err := runArgv([]string{"nginx", "-t"}, ""); err != nil {
		return err
	}
	_, err = reloadNginx()
	return err
}

func readNginxVhost(name string) (string, error) {
	confPath, err := vhostConfPath(name)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(confPath)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func deleteNginxVhost(name string) error {
	confPath, err := vhostConfPath(name)
	if err != nil {
		return err
	}
	_ = os.Remove(filepath.Join(nginxEnabled, name+".conf"))
	_ = os.Remove(confPath)
	_, err = reloadNginx()
	return err
}

func listNginxVhosts() ([]map[string]string, error) {
	entries, err := os.ReadDir(nginxSitesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]string{}, nil
		}
		return nil, err
	}
	out := make([]map[string]string, 0)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".conf") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".conf")
		content, _ := os.ReadFile(filepath.Join(nginxSitesDir, e.Name()))
		v := map[string]string{"name": name, "config_name": e.Name()}
		for _, line := range strings.Split(string(content), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "server_name ") {
				v["server_name"] = strings.TrimSuffix(strings.TrimPrefix(line, "server_name "), ";")
			}
			if strings.HasPrefix(line, "root ") {
				v["root"] = strings.TrimSuffix(strings.TrimPrefix(line, "root "), ";")
			}
			if strings.HasPrefix(line, "listen ") {
				v["listen"] = strings.TrimSuffix(strings.TrimPrefix(line, "listen "), ";")
			}
		}
		if sn, ok := v["server_name"]; ok && sn != "" {
			v["fqdn"] = strings.Fields(sn)[0]
		}
		out = append(out, v)
	}
	return out, nil
}
