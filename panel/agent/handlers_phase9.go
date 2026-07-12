package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var systemDatabases = map[string]bool{
	"information_schema": true,
	"mysql":              true,
	"performance_schema": true,
	"sys":                true,
}

func filterSystemDatabases(names []string) []map[string]string {
	out := make([]map[string]string, 0, len(names))
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" || systemDatabases[strings.ToLower(n)] {
			continue
		}
		out = append(out, map[string]string{"name": n})
	}
	return out
}

func parseOpenSSLEnddate(output string) (time.Time, bool) {
	// notAfter=Jul  5 12:00:00 2026 GMT
	const prefix = "notAfter="
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) {
			val := strings.TrimPrefix(line, prefix)
			t, err := time.Parse("Jan 2 15:04:05 2006 MST", val)
			if err != nil {
				t, err = time.Parse("Jan  2 15:04:05 2006 MST", val)
			}
			if err == nil {
				return t, true
			}
		}
	}
	return time.Time{}, false
}

func certExpiryForDomain(domain string) string {
	certPath := filepath.Join("/etc/letsencrypt/live", domain, "cert.pem")
	out, err := runArgv([]string{"openssl", "x509", "-enddate", "-noout", "-in", certPath}, "")
	if err != nil {
		return time.Now().Add(90 * 24 * time.Hour).Format(time.RFC3339)
	}
	if t, ok := parseOpenSSLEnddate(out); ok {
		return t.UTC().Format(time.RFC3339)
	}
	return time.Now().Add(90 * 24 * time.Hour).Format(time.RFC3339)
}

func revokeSslCert(domain string) error {
	certPath := filepath.Join("/etc/letsencrypt/live", domain, "cert.pem")
	if _, err := os.Stat(certPath); err == nil {
		if _, err := runArgv([]string{"certbot", "revoke", "--cert-path", certPath, "--non-interactive"}, ""); err != nil {
			return err
		}
	}
	_, err := runArgv([]string{"certbot", "delete", "--cert-name", domain, "--non-interactive"}, "")
	return err
}

func ensureFtpSystemUser(username, homeDir string) error {
	_, err := runArgv([]string{"id", "-u", username}, "")
	if err == nil {
		return nil
	}
	_, err = runArgv([]string{"useradd", "-d", homeDir, "-s", "/usr/sbin/nologin", "-M", username}, "")
	return err
}

func setPurePwPassword(username, password string) error {
	if password == "" {
		return nil
	}
	tmp := filepath.Join(os.TempDir(), "webino-pw-"+username)
	content := username + ":" + password + "\n"
	if err := os.WriteFile(tmp, []byte(content), 0o600); err != nil {
		return err
	}
	defer os.Remove(tmp)
	_, err := runArgv([]string{"pure-pw", "passwd", username, "-f", tmp, "-m"}, "")
	return err
}

func buildPhpPoolConf(name, version, domain string, settings map[string]any) string {
	pmMax := "5"
	pmStart := "2"
	if settings != nil {
		if v, ok := settings["pm.max_children"]; ok {
			pmMax = fmt.Sprint(v)
		}
		if v, ok := settings["pm.start_servers"]; ok {
			pmStart = fmt.Sprint(v)
		}
	}
	conf := fmt.Sprintf(`[%s]
user = www-data
group = www-data
listen = /run/php/php%s-fpm-%s.sock
pm = dynamic
pm.max_children = %s
pm.start_servers = %s
`, name, version, name, pmMax, pmStart)
	if domain != "" {
		conf += fmt.Sprintf("; domain = %s\n", domain)
	}
	if settings != nil {
		for k, v := range settings {
			if k == "pm.max_children" || k == "pm.start_servers" {
				continue
			}
			if !allowedPhpSettings[k] {
				continue
			}
			key := k
			if !strings.Contains(k, "[") && !strings.HasPrefix(k, "php_") {
				key = "php_admin_value[" + k + "]"
			}
			conf += fmt.Sprintf("%s = %v\n", key, v)
		}
	}
	return conf
}

func formatMailQuotaRule(quotaMB int) string {
	if quotaMB <= 0 {
		return ""
	}
	return fmt.Sprintf("quota_rule = *:storage=%dM", quotaMB)
}

func setMailQuota(address string, quotaMB int) error {
	if quotaMB <= 0 {
		return nil
	}
	_, err := runArgv([]string{"doveadm", "quota", "set", "-u", address, fmt.Sprintf("storage=%dM", quotaMB)}, "")
	return err
}

func listMysqlDatabases() ([]map[string]string, error) {
	out, err := runArgv([]string{"mysql", "-N", "-e", "SHOW DATABASES"}, "")
	if err != nil {
		return nil, err
	}
	names := strings.Split(out, "\n")
	return filterSystemDatabases(names), nil
}

func listPdnsZones() ([]map[string]string, error) {
	out, err := runArgv([]string{"pdnsutil", "list-all-zones"}, "")
	if err != nil {
		return nil, err
	}
	zones := make([]map[string]string, 0)
	for _, line := range strings.Split(out, "\n") {
		z := strings.TrimSpace(line)
		if z == "" || strings.HasPrefix(z, "All zonecount") {
			continue
		}
		zones = append(zones, map[string]string{"domain": strings.TrimSuffix(z, ".")})
	}
	return zones, nil
}

func listLetsEncryptCerts() []map[string]string {
	base := "/etc/letsencrypt/live"
	entries, err := os.ReadDir(base)
	if err != nil {
		return nil
	}
	out := make([]map[string]string, 0)
	for _, e := range entries {
		if !e.IsDir() || e.Name() == "README" {
			continue
		}
		domain := e.Name()
		out = append(out, map[string]string{
			"domain":     domain,
			"expires_at": certExpiryForDomain(domain),
			"issuer":     "Let's Encrypt",
		})
	}
	return out
}

func listFtpAccounts() []map[string]string {
	out, err := runArgv([]string{"pure-pw", "list"}, "")
	if err != nil {
		return nil
	}
	accounts := make([]map[string]string, 0)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) > 0 {
			accounts = append(accounts, map[string]string{"username": fields[0]})
		}
	}
	return accounts
}

func listMailAccountsFromMaps() []map[string]string {
	vmailbox := filepath.Join(mailVmapDir, "vmailbox")
	lines, err := readMapLines(vmailbox)
	if err != nil {
		return nil
	}
	out := make([]map[string]string, 0)
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) > 0 {
			out = append(out, map[string]string{"address": parts[0]})
		}
	}
	return out
}

func listCrontabLines(username string) []map[string]string {
	existing, _ := runCrontab(username, "-l")
	out := make([]map[string]string, 0)
	for _, line := range strings.Split(existing, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, map[string]string{"line": line})
	}
	return out
}

func listBackupFiles() []map[string]any {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil
	}
	out := make([]map[string]any, 0)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, _ := e.Info()
		size := int64(0)
		if info != nil {
			size = info.Size()
		}
		out = append(out, map[string]any{
			"filename": e.Name(),
			"size":     size,
		})
	}
	return out
}
