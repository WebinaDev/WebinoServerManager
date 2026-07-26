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
	Fqdn             string
	Aliases          []string
	Root             string
	PhpPool          string
	PhpVersion       string
	Ssl              bool
	ForceHTTPS       bool
	Hsts             bool
	Http3            bool
	Redirects        []map[string]string
	ProxyPass        string
	Htpasswd         string
	ErrorPages       map[string]string
	HotlinkProtect   bool
	RewriteTemplate  string
	RewriteCustom    string
	DenyPaths        []string
	TrafficLimitMB   int
	AccessLog        string
	ErrorLog         string
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
	engine := strings.ToLower(strVal(body["engine"]))
	if engine == "" {
		engine = "nginx"
	}
	if engine != "nginx" && engine != "apache" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "engine must be nginx or apache"})
		return
	}
	http3 := body["http3"] == true
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
			Fqdn:            strVal(body["fqdn"]),
			Aliases:         stringSlice(body["aliases"]),
			Root:            strVal(body["document_root"]),
			PhpPool:         strVal(body["php_pool"]),
			PhpVersion:      strVal(body["php_version"]),
			Ssl:             body["ssl"] == true,
			ForceHTTPS:      body["force_https"] == true,
			Hsts:            body["hsts"] == true,
			Http3:           http3 && engine == "nginx",
			ProxyPass:       strVal(body["proxy_pass"]),
			HotlinkProtect:  body["hotlink_protect"] == true || body["hotlink"] == true,
			RewriteTemplate: strVal(body["rewrite_template"]),
			RewriteCustom:   strVal(body["rewrite_custom"]),
			DenyPaths:       stringSlice(body["deny_paths"]),
			TrafficLimitMB:  intVal(body["traffic_limit_mb"]),
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
		opts.AccessLog, opts.ErrorLog = vhostLogPaths(opts.Fqdn)
		if engine == "apache" {
			content = buildApacheVhost(opts)
		} else {
			content = buildNginxVhost(opts)
		}
	}
	var confPath string
	var err error
	if engine == "apache" {
		err = writeApacheVhost(name, content)
		confPath, _ = apacheVhostConfPath(name)
	} else {
		err = writeNginxVhost(name, content)
		confPath, _ = vhostConfPath(name)
	}
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"name": name, "config": confPath, "engine": engine})
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
		engine := strings.ToLower(r.URL.Query().Get("engine"))
		content, err := readVhostByEngine(vhostName, engine)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"name": vhostName, "content": content})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method == http.MethodDelete && action == "" {
		engine := strings.ToLower(r.URL.Query().Get("engine"))
		if err := deleteVhostByEngine(vhostName, engine); err != nil {
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
	engine := strings.ToLower(strVal(body["engine"]))
	content, err := readVhostByEngine(name, engine)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	if engine == "" {
		if _, e := readNginxVhost(name); e == nil {
			engine = "nginx"
		} else {
			engine = "apache"
		}
	}
	switch action {
	case "redirects":
		from := strVal(body["from"])
		to := strVal(body["to"])
		code := strVal(body["code"])
		if code == "" {
			code = "301"
		}
		if engine == "apache" {
			content += fmt.Sprintf("\n    Redirect %s %s %s\n", code, from, to)
		} else {
			block := fmt.Sprintf("\n    location %s { return %s %s; }\n", from, code, to)
			content += block
		}
	case "proxy":
		target := strVal(body["target"])
		if engine == "apache" {
			content += fmt.Sprintf("\n    ProxyPass / %s\n    ProxyPassReverse / %s\n", target, target)
		} else {
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
		}
	case "htpasswd":
		user := strVal(body["user"])
		pass := strVal(body["password"])
		path := strVal(body["path"])
		if path == "" {
			path = "/"
		}
		htfile := filepath.Join(nginxSitesDir, name+".htpasswd")
		if engine == "apache" {
			htfile = filepath.Join(apacheSitesDir, name+".htpasswd")
		}
		_, _ = runArgv([]string{"htpasswd", "-cb", htfile, user, pass}, "")
		if engine == "apache" {
			content += fmt.Sprintf(`
    <Location "%s">
        AuthType Basic
        AuthName "Restricted"
        AuthUserFile %s
        Require valid-user
    </Location>
`, path, htfile)
		} else {
			block := fmt.Sprintf(`
    location %s {
        auth_basic "Restricted";
        auth_basic_user_file %s;
    }
`, path, htfile)
			content += block
		}
	case "ssl":
		fqdn := strings.ReplaceAll(name, "_", ".")
		plugin := "--nginx"
		if engine == "apache" {
			plugin = "--apache"
		}
		_, _ = runArgv([]string{"certbot", "certonly", plugin, "-d", fqdn, "--non-interactive", "--agree-tos", "-m", "admin@" + fqdn}, "")
		if engine == "apache" {
			content = strings.Replace(content, "<VirtualHost *:80>", "<VirtualHost *:80>\n# SSL managed separately on *:443", 1)
			content += fmt.Sprintf(`
<VirtualHost *:443>
    ServerName %s
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/%s/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/%s/privkey.pem
</VirtualHost>
`, fqdn, fqdn, fqdn)
		} else {
			content = strings.Replace(content, "listen 80;", "listen 80;\n    listen 443 ssl http2;", 1)
			content += fmt.Sprintf("\n    ssl_certificate /etc/letsencrypt/live/%s/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/%s/privkey.pem;\n", fqdn, fqdn)
		}
	case "hsts":
		if engine == "apache" {
			content += "\n    Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"\n"
		} else {
			content += "\n    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n"
		}
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		return
	}
	var writeErr error
	if engine == "apache" {
		writeErr = writeApacheVhost(name, content)
	} else {
		writeErr = writeNginxVhost(name, content)
	}
	if writeErr != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: writeErr.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"name": name, "action": action, "engine": engine})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func buildNginxVhost(opts nginxVhostOpts) string {
	var b strings.Builder
	b.WriteString("server {\n")
	b.WriteString("    listen 80;\n")
	if opts.Ssl {
		b.WriteString("    listen 443 ssl http2;\n")
		if opts.Http3 {
			b.WriteString("    listen 443 quic reuseport;\n")
			b.WriteString("    add_header Alt-Svc 'h3=\":443\"; ma=86400' always;\n")
		}
		fqdn := opts.Fqdn
		b.WriteString(fmt.Sprintf("    ssl_certificate /etc/letsencrypt/live/%s/fullchain.pem;\n", fqdn))
		b.WriteString(fmt.Sprintf("    ssl_certificate_key /etc/letsencrypt/live/%s/privkey.pem;\n", fqdn))
	}
	serverNames := opts.Fqdn
	for _, a := range opts.Aliases {
		a = strings.TrimSpace(a)
		if a != "" && !strings.EqualFold(a, opts.Fqdn) {
			serverNames += " " + a
		}
	}
	b.WriteString(fmt.Sprintf("    server_name %s;\n", serverNames))
	b.WriteString(fmt.Sprintf("    root %s;\n", opts.Root))
	b.WriteString("    index index.html index.php;\n")
	if opts.AccessLog != "" {
		b.WriteString(fmt.Sprintf("    access_log %s;\n", opts.AccessLog))
	}
	if opts.ErrorLog != "" {
		b.WriteString(fmt.Sprintf("    error_log %s;\n", opts.ErrorLog))
	}
	if opts.ForceHTTPS {
		b.WriteString("    if ($scheme = http) { return 301 https://$host$request_uri; }\n")
	}
	if opts.Hsts {
		b.WriteString("    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n")
	}
	if opts.TrafficLimitMB > 0 {
		// Approximate: MB/s ≈ traffic_limit_mb as rate ceiling (bytes/s = MB * 1024 * 1024 / 8 is too harsh;
		// use MB/s as limit_rate in bytes: traffic_limit_mb KiB/s * 1024 for a soft cap).
		rate := opts.TrafficLimitMB * 1024
		if rate < 1024 {
			rate = 1024
		}
		b.WriteString(fmt.Sprintf("    limit_rate %dk;\n", rate))
	}
	for _, p := range opts.DenyPaths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		b.WriteString(fmt.Sprintf("    location = %s { deny all; }\n", p))
		b.WriteString(fmt.Sprintf("    location ^~ %s/ { deny all; }\n", strings.TrimSuffix(p, "/")))
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
		b.WriteString(rewriteLocationBlock(opts))
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

func rewriteLocationBlock(opts nginxVhostOpts) string {
	tmpl := strings.ToLower(strings.TrimSpace(opts.RewriteTemplate))
	switch tmpl {
	case "wordpress":
		return `    location / {
        try_files $uri $uri/ /index.php?$args;
    }
`
	case "laravel":
		return `    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
`
	case "custom":
		custom := strings.TrimSpace(opts.RewriteCustom)
		if custom == "" {
			custom = "try_files $uri $uri/ =404;"
		}
		return fmt.Sprintf("    location / {\n        %s\n    }\n", custom)
	default:
		return "    location / { try_files $uri $uri/ =404; }\n"
	}
}

func buildApacheVhost(opts nginxVhostOpts) string {
	var b strings.Builder
	serverNames := opts.Fqdn
	aliases := make([]string, 0)
	for _, a := range opts.Aliases {
		a = strings.TrimSpace(a)
		if a != "" && !strings.EqualFold(a, opts.Fqdn) {
			aliases = append(aliases, a)
			serverNames += " " + a
		}
	}
	b.WriteString("<VirtualHost *:80>\n")
	b.WriteString(fmt.Sprintf("    ServerName %s\n", opts.Fqdn))
	for _, a := range aliases {
		b.WriteString(fmt.Sprintf("    ServerAlias %s\n", a))
	}
	b.WriteString(fmt.Sprintf("    DocumentRoot %s\n", opts.Root))
	b.WriteString(fmt.Sprintf("    <Directory %s>\n        AllowOverride All\n        Require all granted\n    </Directory>\n", opts.Root))
	if opts.ForceHTTPS {
		b.WriteString("    RewriteEngine On\n    RewriteCond %{HTTPS} off\n    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n")
	}
	if opts.Hsts {
		b.WriteString("    Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"\n")
	}
	for _, p := range opts.DenyPaths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		b.WriteString(fmt.Sprintf("    <Location \"%s\">\n        Require all denied\n    </Location>\n", p))
	}
	tmpl := strings.ToLower(strings.TrimSpace(opts.RewriteTemplate))
	switch tmpl {
	case "wordpress":
		b.WriteString("    RewriteEngine On\n    RewriteRule ^index\\.php$ - [L]\n    RewriteCond %{REQUEST_FILENAME} !-f\n    RewriteCond %{REQUEST_FILENAME} !-d\n    RewriteRule . /index.php [L]\n")
	case "laravel":
		b.WriteString("    FallbackResource /index.php\n")
	}
	if opts.ProxyPass != "" {
		b.WriteString(fmt.Sprintf("    ProxyPass / %s\n    ProxyPassReverse / %s\n", opts.ProxyPass, opts.ProxyPass))
	}
	if opts.PhpPool != "" {
		ver := opts.PhpVersion
		if ver == "" {
			ver = "8.2"
		}
		sock := fmt.Sprintf("/run/php/php%s-fpm-%s.sock", ver, opts.PhpPool)
		b.WriteString(fmt.Sprintf("    <FilesMatch \\.php$>\n        SetHandler \"proxy:unix:%s|fcgi://localhost\"\n    </FilesMatch>\n", sock))
	}
	if opts.HotlinkProtect {
		b.WriteString("    RewriteEngine On\n    RewriteCond %{HTTP_REFERER} !^$\n    RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?"+strings.ReplaceAll(opts.Fqdn, ".", "\\.")+" [NC]\n    RewriteRule \\.(gif|jpg|jpeg|png|webp)$ - [F]\n")
	}
	if opts.Ssl {
		b.WriteString(fmt.Sprintf("    # Primary SSL vhost follows\n</VirtualHost>\n\n<VirtualHost *:443>\n    ServerName %s\n", opts.Fqdn))
		for _, a := range aliases {
			b.WriteString(fmt.Sprintf("    ServerAlias %s\n", a))
		}
		b.WriteString(fmt.Sprintf("    DocumentRoot %s\n", opts.Root))
		b.WriteString("    SSLEngine on\n")
		b.WriteString(fmt.Sprintf("    SSLCertificateFile /etc/letsencrypt/live/%s/fullchain.pem\n", opts.Fqdn))
		b.WriteString(fmt.Sprintf("    SSLCertificateKeyFile /etc/letsencrypt/live/%s/privkey.pem\n", opts.Fqdn))
		if opts.Hsts {
			b.WriteString("    Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"\n")
		}
		if opts.PhpPool != "" {
			ver := opts.PhpVersion
			if ver == "" {
				ver = "8.2"
			}
			sock := fmt.Sprintf("/run/php/php%s-fpm-%s.sock", ver, opts.PhpPool)
			b.WriteString(fmt.Sprintf("    <FilesMatch \\.php$>\n        SetHandler \"proxy:unix:%s|fcgi://localhost\"\n    </FilesMatch>\n", sock))
		}
	}
	b.WriteString("</VirtualHost>\n")
	_ = serverNames
	return b.String()
}

func readVhostByEngine(name, engine string) (string, error) {
	engine = strings.ToLower(engine)
	if engine == "apache" {
		return readApacheVhost(name)
	}
	if engine == "nginx" || engine == "" {
		content, err := readNginxVhost(name)
		if err == nil || engine == "nginx" {
			return content, err
		}
		return readApacheVhost(name)
	}
	return "", fmt.Errorf("unknown engine")
}

func deleteVhostByEngine(name, engine string) error {
	engine = strings.ToLower(engine)
	switch engine {
	case "apache":
		return deleteApacheVhost(name)
	case "nginx":
		return deleteNginxVhost(name)
	default:
		_ = deleteNginxVhost(name)
		_ = deleteApacheVhost(name)
		return nil
	}
}

func apacheVhostConfPath(name string) (string, error) {
	if err := validateSafeName(name, 64); err != nil {
		return "", err
	}
	confPath := filepath.Join(apacheSitesDir, name+".conf")
	return jailPathUnder(apacheSitesDir, confPath)
}

func writeApacheVhost(name, content string) error {
	_ = os.MkdirAll(apacheSitesDir, 0o755)
	_ = os.MkdirAll(apacheEnabled, 0o755)
	confPath, err := apacheVhostConfPath(name)
	if err != nil {
		return err
	}
	enabledPath := filepath.Join(apacheEnabled, name+".conf")
	if err := os.WriteFile(confPath, []byte(content), 0o644); err != nil {
		return err
	}
	_ = os.Remove(enabledPath)
	_ = os.Symlink(confPath, enabledPath)
	if _, err := runArgv([]string{"apache2ctl", "configtest"}, ""); err != nil {
		// try httpd for RHEL-ish
		if _, err2 := runArgv([]string{"apachectl", "configtest"}, ""); err2 != nil {
			return err
		}
	}
	_, err = reloadApache()
	return err
}

func readApacheVhost(name string) (string, error) {
	confPath, err := apacheVhostConfPath(name)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(confPath)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func deleteApacheVhost(name string) error {
	confPath, err := apacheVhostConfPath(name)
	if err != nil {
		return err
	}
	_ = os.Remove(filepath.Join(apacheEnabled, name+".conf"))
	_ = os.Remove(confPath)
	_, err = reloadApache()
	return err
}

func reloadApache() (string, error) {
	if out, err := runArgv([]string{"apache2ctl", "graceful"}, ""); err == nil {
		return out, nil
	}
	return runArgv([]string{"apachectl", "graceful"}, "")
}

func vhostLogDir() string {
	return envOr("WEBINO_NGINX_LOG_DIR", "/var/log/nginx")
}

func vhostLogPaths(fqdn string) (access, errLog string) {
	safe := strings.ReplaceAll(strings.ToLower(fqdn), "/", "_")
	dir := vhostLogDir()
	_ = os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, safe+".access.log"), filepath.Join(dir, safe+".error.log")
}

func stringSlice(v any) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []any:
		out := make([]string, 0, len(t))
		for _, item := range t {
			s := strings.TrimSpace(fmt.Sprint(item))
			if s != "" && s != "<nil>" {
				out = append(out, s)
			}
		}
		return out
	case string:
		parts := strings.FieldsFunc(t, func(r rune) bool {
			return r == ',' || r == ' ' || r == '\n'
		})
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		return out
	default:
		return nil
	}
}

func intVal(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case json.Number:
		i, _ := t.Int64()
		return int(i)
	case string:
		var n int
		_, _ = fmt.Sscanf(t, "%d", &n)
		return n
	default:
		return 0
	}
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
