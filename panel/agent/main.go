// webino-agent — privileged host agent for WebinoServer panel (unix socket HTTP API).
package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type envelope struct {
	OK      bool            `json:"ok"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
	Command string          `json:"command,omitempty"`
}

var (
	webinaRoot  string
	filesRoot   string
	gitRoot     string
	backupDir   string
	sharedToken string
)

func main() {
	socket := envOr("WEBINO_AGENT_SOCKET", "/run/webino-agent.sock")
	webinaRoot = envOr("WEBINO_SERVER_ROOT", "/opt/WebinoServer")
	filesRoot = envOr("WEBINO_FILES_ROOT", "/var/www")
	gitRoot = envOr("WEBINO_GIT_ROOT", "/var/www/git")
	backupDir = envOr("WEBINO_BACKUP_DIR", "/var/backups/webino")
	sharedToken = envOr("WEBINO_AGENT_TOKEN", "")
	wsAddr := envOr("WEBINO_AGENT_WS_ADDR", "127.0.0.1:9091")
	if sharedToken == "" {
		if envOr("WEBINO_AGENT_ALLOW_UNAUTH", "") == "true" {
			log.Printf("WARNING: WEBINO_AGENT_TOKEN is empty — agent API is unauthenticated")
		} else {
			log.Fatal("WEBINO_AGENT_TOKEN is required (set WEBINO_AGENT_ALLOW_UNAUTH=true for local dev only)")
		}
	}
	initPhase7Env()
	initSecurityEnv()
	initMailEnv()
	initHostingEnv()
	initDockerEnv()

	go startWebSocketServer(wsAddr)

	_ = os.Remove(socket)
	ln, err := net.Listen("unix", socket)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	_ = os.Chmod(socket, 0o660)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/v1/webina", handleWebina)
	mux.HandleFunc("/v1/domains", handleDomains)
	mux.HandleFunc("/v1/databases", handleDatabases)
	mux.HandleFunc("/v1/system/info", handleSystemInfo)
	mux.HandleFunc("/v1/dns/zones", handleDnsZonesExtended)
	mux.HandleFunc("/v1/dns/records", handleDnsRecordsExtended)
	mux.HandleFunc("/v1/dns/records/counts", handleDnsRecordCounts)
	mux.HandleFunc("/v1/ssl/certificates", handleSslCertificates)
	mux.HandleFunc("/v1/ftp/accounts", handleFtpAccounts)
	mux.HandleFunc("/v1/php/pools", handlePhpPools)
	mux.HandleFunc("/v1/mail/accounts", handleMailAccounts)
	mux.HandleFunc("/v1/mail/forwarders", handleMailForwarders)
	mux.HandleFunc("/v1/mail/domains", handleMailDomains)
	mux.HandleFunc("/v1/subdomains", handleSubdomains)
	mux.HandleFunc("/v1/files", handleFiles)
	mux.HandleFunc("/v1/cron", handleCron)
	mux.HandleFunc("/v1/backups", handleBackups)
	mux.HandleFunc("/v1/git", handleGit)
	mux.HandleFunc("/v1/wordpress", handleWordpress)
	mux.HandleFunc("/v1/security/firewall", handleSecurityFirewall)
	mux.HandleFunc("/v1/security/fail2ban", handleSecurityFail2ban)
	mux.HandleFunc("/v1/security/fail2ban/filters", handleSecurityFail2banFilters)
	mux.HandleFunc("/v1/security/sshkeys", handleSecuritySshKeys)
	mux.HandleFunc("/v1/security/clamav", handleSecurityClamav)
	mux.HandleFunc("/v1/security/waf", handleSecurityWaf)
	mux.HandleFunc("/v1/mail/dkim", handleMailDkim)
	mux.HandleFunc("/v1/mail/antispam", handleMailAntispam)
	mux.HandleFunc("/v1/mail/autoresponders", handleMailAutoresponders)
	mux.HandleFunc("/v1/mail/lists", handleMailLists)
	mux.HandleFunc("/v1/mail/catchall", handleMailCatchall)
	mux.HandleFunc("/v1/mail/quota", handleMailQuota)
	mux.HandleFunc("/v1/mail/queue", handleMailQueue)
	mux.HandleFunc("/v1/vhosts", handleVhosts)
	mux.HandleFunc("/v1/vhosts/", handleVhostByName)
	mux.HandleFunc("/v1/hosting/suspend", handleHostingSuspend)
	mux.HandleFunc("/v1/hosting/unsuspend", handleHostingUnsuspend)
	mux.HandleFunc("/v1/hosting/usage", handleHostingUsage)
	mux.HandleFunc("/v1/databases/users", handleDatabaseUsers)
	mux.HandleFunc("/v1/databases/remote-access", handleDatabaseRemoteAccess)
	mux.HandleFunc("/v1/docker/containers", handleDockerContainers)
	mux.HandleFunc("/v1/docker/images", handleDockerImages)
	mux.HandleFunc("/v1/services", handleServices)
	mux.HandleFunc("/v1/logs", handleLogs)

	log.Printf("webino-agent listening on %s (root=%s, backups=%s)", socket, webinaRoot, backupDir)
	log.Fatal(http.Serve(ln, authMiddleware(mux)))
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if sharedToken != "" && r.Header.Get("X-Agent-Token") != sharedToken {
			writeJSON(w, http.StatusUnauthorized, envelope{OK: false, Error: "unauthorized"})
			return
		}
		if sharedToken == "" && envOr("WEBINO_AGENT_ALLOW_UNAUTH", "") != "true" {
			writeJSON(w, http.StatusUnauthorized, envelope{OK: false, Error: "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: json.RawMessage(`{"status":"ok"}`)})
}

type execRequest struct {
	Argv []string `json:"argv"`
	Dir  string   `json:"dir"`
}

type webinaRequest struct {
	Args []string `json:"args"`
}

func handleWebina(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var req webinaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if err := allowedWebinaArgs(req.Args); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	webina := filepath.Join(webinaRoot, "bin", "webina")
	argv := append([]string{webina}, req.Args...)
	out, err := runArgv(argv, webinaRoot)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handleDomains(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		data, _ := json.Marshal(map[string]any{"domains": listDomainsFromRegistry()})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body struct {
			Domain  string `json:"domain"`
			Aliases string `json:"aliases"`
			Slug    string `json:"slug"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		slug := body.Slug
		if slug == "" {
			slug = strings.Split(body.Domain, ".")[0]
		}
		webina := filepath.Join(webinaRoot, "bin", "webina")
		argv := []string{webina, "site", "create", "--slug", slug, "--domain", body.Domain}
		if body.Aliases != "" {
			argv = append(argv, "--alias", body.Aliases)
		}
		out, err := runArgv(argv, webinaRoot)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "slug": slug})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func listDomainsFromRegistry() []map[string]string {
	reg := "/var/lib/webina/registry.json"
	b, err := os.ReadFile(reg)
	if err != nil {
		return nil
	}
	var doc struct {
		Sites []struct {
			Slug   string `json:"slug"`
			Domain string `json:"domain"`
		} `json:"sites"`
	}
	if json.Unmarshal(b, &doc) != nil {
		return nil
	}
	out := make([]map[string]string, 0, len(doc.Sites))
	for _, s := range doc.Sites {
		out = append(out, map[string]string{"slug": s.Slug, "domain": s.Domain})
	}
	return out
}

func runArgv(argv []string, dir string) (string, error) {
	unlock := acquireExecLock(execLockKey(argv))
	defer unlock()
	cmd := exec.Command(argv[0], argv[1:]...)
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return strings.TrimSpace(string(out)), nil
}

func writeMethod(w http.ResponseWriter) {
	writeJSON(w, http.StatusMethodNotAllowed, envelope{OK: false, Error: "method not allowed"})
}

func writeJSON(w http.ResponseWriter, code int, v envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
