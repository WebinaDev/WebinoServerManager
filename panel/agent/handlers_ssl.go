package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	webinoSslBaseDir = "/etc/ssl/webino"
	webinoHookDir    = "/usr/local/lib/webino"
)

func handleSslCertificatesExtended(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		certs := listAllSslCerts()
		data, _ := json.Marshal(map[string]any{"certificates": certs})
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
	handleSslPost(w, body)
}

func handleSslPost(w http.ResponseWriter, body map[string]any) {
	action := strVal(body["action"])
	if action == "" {
		action = "issue"
	}
	domain := strings.ToLower(strVal(body["domain"]))
	if domain != "" {
		if err := validateDomain(domain); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
	}

	switch action {
	case "revoke":
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		if err := revokeSslCert(domain); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "revoked": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "renew":
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		out, err := sslRenew(domain)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		expires := certExpiryForDomain(domain)
		data, _ := json.Marshal(map[string]string{"domain": domain, "expires_at": expires, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "issue_wildcard":
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		out, err := sslIssueWildcard(domain)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		expires := certExpiryForDomain(domain)
		data, _ := json.Marshal(map[string]string{
			"domain": domain, "issuer": "Let's Encrypt", "expires_at": expires, "output": out,
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "upload_custom":
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		result, err := sslUploadCustom(domain, strVal(body["cert_pem"]), strVal(body["key_pem"]), strVal(body["chain_pem"]))
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "validate_chain":
		result := sslValidateChain(strVal(body["cert_pem"]), strVal(body["key_pem"]), strVal(body["chain_pem"]))
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "bind_service":
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		service := strVal(body["service"])
		if err := sslBindService(domain, service); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"domain": domain, "service": service, "bound": "true"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "domain required"})
			return
		}
		argv := []string{
			"certbot", "certonly", "--nginx", "-d", domain,
			"--non-interactive", "--agree-tos", "-m", "admin@" + domain,
		}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error(), Command: strings.Join(argv, " ")})
			return
		}
		expires := certExpiryForDomain(domain)
		data, _ := json.Marshal(map[string]string{
			"domain": domain, "issuer": "Let's Encrypt", "expires_at": expires, "output": out,
		})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	}
}

func listAllSslCerts() []map[string]string {
	certs := listLetsEncryptCerts()
	custom := listCustomSslCerts()
	return append(certs, custom...)
}

func listCustomSslCerts() []map[string]string {
	entries, err := os.ReadDir(webinoSslBaseDir)
	if err != nil {
		return nil
	}
	out := make([]map[string]string, 0)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		domain := e.Name()
		certPath := filepath.Join(webinoSslBaseDir, domain, "fullchain.pem")
		if _, err := os.Stat(certPath); err != nil {
			continue
		}
		expires := certExpiryForPath(certPath)
		out = append(out, map[string]string{
			"domain":     domain,
			"expires_at": expires,
			"issuer":     "custom",
			"type":       "custom",
		})
	}
	return out
}

func certExpiryForPath(certPath string) string {
	out, err := runArgv([]string{"openssl", "x509", "-enddate", "-noout", "-in", certPath}, "")
	if err != nil {
		return ""
	}
	if t, ok := parseOpenSSLEnddate(out); ok {
		return t.UTC().Format(time.RFC3339)
	}
	return ""
}

func sslRenew(domain string) (string, error) {
	argv := []string{"certbot", "renew", "--cert-name", domain, "--non-interactive"}
	out, err := runArgv(argv, "")
	if err != nil {
		return out, err
	}
	_, _ = reloadNginx()
	return out, nil
}

func sslIssueWildcard(domain string) (string, error) {
	if err := buildCertbotDnsHooks(); err != nil {
		return "", err
	}
	authHook := filepath.Join(webinoHookDir, "certbot-pdns-auth.sh")
	cleanupHook := filepath.Join(webinoHookDir, "certbot-pdns-cleanup.sh")
	wildcard := "*." + domain
	argv := []string{
		"certbot", "certonly", "--manual", "--preferred-challenges", "dns",
		"--manual-auth-hook", authHook,
		"--manual-cleanup-hook", cleanupHook,
		"-d", wildcard, "-d", domain,
		"--non-interactive", "--agree-tos", "-m", "admin@" + domain,
	}
	return runArgv(argv, "")
}

func buildCertbotDnsHooks() error {
	_ = os.MkdirAll(webinoHookDir, 0o755)
	auth := `#!/bin/bash
set -euo pipefail
ZONE="${CERTBOT_DOMAIN}"
pdnsutil add-record "${ZONE}" "_acme-challenge" TXT 60 "${CERTBOT_VALIDATION}"
pdnsutil rectify-zone "${ZONE}"
`
	cleanup := `#!/bin/bash
set -euo pipefail
ZONE="${CERTBOT_DOMAIN}"
pdnsutil delete-rrset "${ZONE}" "_acme-challenge" TXT || true
pdnsutil rectify-zone "${ZONE}" || true
`
	if err := os.WriteFile(filepath.Join(webinoHookDir, "certbot-pdns-auth.sh"), []byte(auth), 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(webinoHookDir, "certbot-pdns-cleanup.sh"), []byte(cleanup), 0o755)
}

func sslUploadCustom(domain, certPem, keyPem, chainPem string) (map[string]string, error) {
	valid := sslValidateChain(certPem, keyPem, chainPem)
	if valid["valid"] != "true" {
		return valid, fmt.Errorf("chain validation failed: %s", valid["error"])
	}
	dir := filepath.Join(webinoSslBaseDir, domain)
	if _, err := jailPathUnder(webinoSslBaseDir, dir); err != nil {
		return nil, err
	}
	_ = os.MkdirAll(dir, 0o700)
	fullchain := certPem
	if chainPem != "" {
		fullchain = certPem + "\n" + chainPem
	}
	if err := os.WriteFile(filepath.Join(dir, "fullchain.pem"), []byte(fullchain), 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, "privkey.pem"), []byte(keyPem), 0o600); err != nil {
		return nil, err
	}
	if chainPem != "" {
		_ = os.WriteFile(filepath.Join(dir, "chain.pem"), []byte(chainPem), 0o600)
	}
	expires := certExpiryForPath(filepath.Join(dir, "fullchain.pem"))
	return map[string]string{
		"domain": domain, "issuer": valid["issuer"], "expires_at": expires,
		"cert_path": filepath.Join(dir, "fullchain.pem"),
		"key_path":  filepath.Join(dir, "privkey.pem"),
		"valid":     "true",
	}, nil
}

func sslValidateChain(certPem, keyPem, chainPem string) map[string]string {
	result := map[string]string{"valid": "false"}
	if certPem == "" || keyPem == "" {
		result["error"] = "cert_pem and key_pem required"
		return result
	}
	tmp := os.TempDir()
	certFile := filepath.Join(tmp, "webino-validate-cert.pem")
	keyFile := filepath.Join(tmp, "webino-validate-key.pem")
	chainFile := filepath.Join(tmp, "webino-validate-chain.pem")
	defer os.Remove(certFile)
	defer os.Remove(keyFile)
	defer os.Remove(chainFile)
	_ = os.WriteFile(certFile, []byte(certPem), 0o600)
	_ = os.WriteFile(keyFile, []byte(keyPem), 0o600)
	verifyArgs := []string{"openssl", "verify"}
	if chainPem != "" {
		_ = os.WriteFile(chainFile, []byte(chainPem), 0o600)
		verifyArgs = append(verifyArgs, "-CAfile", chainFile)
	}
	verifyArgs = append(verifyArgs, certFile)
	out, err := runArgv(verifyArgs, "")
	if err != nil && !strings.Contains(out, "OK") {
		result["error"] = strings.TrimSpace(out)
		if result["error"] == "" {
			result["error"] = err.Error()
		}
	} else {
		result["valid"] = "true"
	}
	certMod, _ := runArgv([]string{"openssl", "x509", "-noout", "-modulus", "-in", certFile}, "")
	keyMod, _ := runArgv([]string{"openssl", "rsa", "-noout", "-modulus", "-in", keyFile}, "")
	if certMod != "" && keyMod != "" && certMod != keyMod {
		result["valid"] = "false"
		result["error"] = "key does not match certificate"
	}
	issuerOut, _ := runArgv([]string{"openssl", "x509", "-noout", "-issuer", "-in", certFile}, "")
	result["issuer"] = strings.TrimSpace(strings.TrimPrefix(issuerOut, "issuer="))
	endOut, _ := runArgv([]string{"openssl", "x509", "-enddate", "-noout", "-in", certFile}, "")
	if t, ok := parseOpenSSLEnddate(endOut); ok {
		result["expires_at"] = t.UTC().Format("2006-01-02T15:04:05Z07:00")
	}
	return result
}

func sslBindService(domain, service string) error {
	certPath, keyPath := resolveCertPaths(domain)
	if certPath == "" {
		return fmt.Errorf("certificate not found for %s", domain)
	}
	switch service {
	case "mail":
		_, _ = runArgv([]string{"postconf", "-e", fmt.Sprintf("smtpd_tls_cert_file=%s", certPath)}, "")
		_, _ = runArgv([]string{"postconf", "-e", fmt.Sprintf("smtpd_tls_key_file=%s", keyPath)}, "")
		_, _ = runArgv([]string{"systemctl", "reload", "postfix"}, "")
		_, _ = runArgv([]string{"systemctl", "reload", "dovecot"}, "")
	case "panel":
		panelDir := envOr("WEBINO_PANEL_SSL_DIR", "/etc/ssl/webino/panel")
		_ = os.MkdirAll(panelDir, 0o755)
		_ = os.WriteFile(filepath.Join(panelDir, "fullchain.pem"), mustRead(certPath), 0o644)
		_ = os.WriteFile(filepath.Join(panelDir, "privkey.pem"), mustRead(keyPath), 0o600)
		_, _ = runArgv([]string{"systemctl", "reload", "nginx"}, "")
	default:
		return fmt.Errorf("unknown service: %s", service)
	}
	return nil
}

func resolveCertPaths(domain string) (cert, key string) {
	leCert := filepath.Join("/etc/letsencrypt/live", domain, "fullchain.pem")
	leKey := filepath.Join("/etc/letsencrypt/live", domain, "privkey.pem")
	if _, err := os.Stat(leCert); err == nil {
		return leCert, leKey
	}
	customCert := filepath.Join(webinoSslBaseDir, domain, "fullchain.pem")
	customKey := filepath.Join(webinoSslBaseDir, domain, "privkey.pem")
	if _, err := os.Stat(customCert); err == nil {
		return customCert, customKey
	}
	return "", ""
}

func mustRead(path string) []byte {
	b, _ := os.ReadFile(path)
	return b
}

func acmeChallengeRecord(domain string) string {
	return "_acme-challenge." + strings.TrimSuffix(domain, ".")
}
