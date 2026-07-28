package main

import (
	"fmt"
	"os/exec"
	"strings"
)

// Stack / hosting Softstore scripts used by the first-run setup wizard.
var softstoreStackScriptIDs = map[string]bool{
	"install_nginx":       true,
	"install_apache":      true,
	"install_mariadb":     true,
	"install_mysql":       true,
	"install_php_fpm_81":  true,
	"install_php_fpm_82":  true,
	"install_php_fpm_83":  true,
	"install_php_fpm_84":  true,
	"install_pureftpd":    true,
	"ensure_ufw_baseline": true,
	"ensure_fail2ban":     true,
}

func softstoreIsStackScript(scriptID string) bool {
	return softstoreStackScriptIDs[scriptID]
}

func probeSoftstoreStackPackage(name string) (installed bool, detail string, ok bool) {
	switch name {
	case "nginx":
		installed, detail = softstoreProbeBins("nginx")
		if !installed {
			installed = softstoreSystemdActive("nginx")
		}
		return installed, detail, true
	case "apache", "apache2":
		installed, detail = softstoreProbeBins("apache2", "httpd")
		if !installed {
			installed = softstoreSystemdActive("apache2") || softstoreSystemdActive("httpd")
		}
		return installed, detail, true
	case "mariadb":
		installed, detail = softstoreProbeBins("mariadbd", "mysqld")
		if !installed {
			installed = softstoreSystemdActive("mariadb") || softstoreSystemdActive("mysql")
		}
		return installed, detail, true
	case "mysql":
		installed, detail = softstoreProbeBins("mysqld")
		if !installed {
			installed = softstoreSystemdActive("mysql") || softstoreSystemdActive("mysqld")
		}
		return installed, detail, true
	case "php-fpm-81", "php81":
		return softstoreProbePHP("8.1")
	case "php-fpm-82", "php82":
		return softstoreProbePHP("8.2")
	case "php-fpm-83", "php83":
		return softstoreProbePHP("8.3")
	case "php-fpm-84", "php84":
		return softstoreProbePHP("8.4")
	case "pureftpd", "pure-ftpd":
		installed, detail = softstoreProbeBins("pure-ftpd", "pure-ftpd-wrapper")
		if !installed {
			installed = softstoreSystemdActive("pure-ftpd") || softstoreSystemdActive("pure-ftpd.service")
		}
		return installed, detail, true
	case "ufw":
		installed, detail = softstoreProbeBins("ufw")
		return installed, detail, true
	case "fail2ban":
		installed, detail = softstoreProbeBins("fail2ban-client", "fail2ban-server")
		if !installed {
			installed = softstoreSystemdActive("fail2ban")
		}
		return installed, detail, true
	default:
		return false, "", false
	}
}

func softstoreProbePHP(ver string) (bool, string, bool) {
	bin := "php-fpm" + ver
	if path, err := exec.LookPath(bin); err == nil {
		return true, path, true
	}
	// Debian packages use php8.2-fpm binary name php-fpm8.2 or php8.2.
	alt := "php" + ver
	if path, err := exec.LookPath(alt); err == nil {
		unit := "php" + ver + "-fpm"
		if softstoreSystemdActive(unit) {
			return true, path, true
		}
		return true, path, true
	}
	unit := "php" + ver + "-fpm"
	if softstoreSystemdActive(unit) {
		return true, unit, true
	}
	return false, "", true
}

func runSoftstoreStackScript(scriptID string) (string, error) {
	switch scriptID {
	case "install_nginx":
		if path, err := exec.LookPath("nginx"); err == nil {
			_ = softstoreEnableService("nginx")
			return "nginx already present: " + path, nil
		}
		out, err := softstoreAptInstall("nginx")
		if err != nil {
			return out, err
		}
		_ = softstoreEnableService("nginx")
		return out, nil
	case "install_apache":
		if path, err := exec.LookPath("apache2"); err == nil {
			_ = softstoreEnableService("apache2")
			return "apache2 already present: " + path, nil
		}
		out, err := softstoreAptInstall("apache2")
		if err != nil {
			return out, err
		}
		_ = softstoreEnableService("apache2")
		return out, nil
	case "install_mariadb":
		if softstoreSystemdActive("mariadb") || softstoreSystemdActive("mysql") {
			return "mariadb/mysql already active", nil
		}
		out, err := softstoreInstallDatabaseServer("mariadb")
		if err != nil {
			return out, err
		}
		_ = softstoreEnableService("mariadb")
		_ = softstoreEnableService("mysql")
		return out, nil
	case "install_mysql":
		if softstoreSystemdActive("mysql") || softstoreSystemdActive("mysqld") || softstoreSystemdActive("mariadb") {
			return "mysql/mariadb already active", nil
		}
		out, err := softstoreInstallDatabaseServer("mysql")
		if err != nil {
			return out, err
		}
		_ = softstoreEnableService("mysql")
		_ = softstoreEnableService("mariadb")
		return out, nil
	case "install_php_fpm_81":
		return softstoreInstallPHP("8.1")
	case "install_php_fpm_82":
		return softstoreInstallPHP("8.2")
	case "install_php_fpm_83":
		return softstoreInstallPHP("8.3")
	case "install_php_fpm_84":
		return softstoreInstallPHP("8.4")
	case "install_pureftpd":
		if path, err := exec.LookPath("pure-ftpd"); err == nil {
			_ = softstoreEnableService("pure-ftpd")
			return "pure-ftpd already present: " + path, nil
		}
		out, err := softstoreAptInstall("pure-ftpd")
		if err != nil {
			// Some distros use pure-ftpd-common + pure-ftpd
			out2, err2 := softstoreAptInstall("pure-ftpd-common", "pure-ftpd")
			if err2 != nil {
				return out + "\n" + out2, err2
			}
			out = out2
		}
		_ = softstoreEnableService("pure-ftpd")
		return out, nil
	case "ensure_ufw_baseline":
		return softstoreEnsureUFWBaseline()
	case "ensure_fail2ban":
		if path, err := exec.LookPath("fail2ban-client"); err == nil {
			_ = softstoreEnableService("fail2ban")
			return "fail2ban already present: " + path, nil
		}
		out, err := softstoreAptInstall("fail2ban")
		if err != nil {
			return out, err
		}
		_ = softstoreEnableService("fail2ban")
		return out, nil
	default:
		return "", errSoftstore("unknown stack script")
	}
}

// softstoreInstallDatabaseServer installs a MySQL-compatible server.
// preference "mariadb" tries mariadb-server first; "mysql" tries mysql-server first.
// Many cloud Ubuntu images omit mariadb-server (universe) and only ship
// default-mysql-server / mysql-server.
func softstoreInstallDatabaseServer(preference string) (string, error) {
	var candidates [][]string
	switch preference {
	case "mysql":
		candidates = [][]string{
			{"mysql-server"},
			{"default-mysql-server"},
			{"mariadb-server"},
		}
	default:
		candidates = [][]string{
			{"mariadb-server"},
			{"default-mysql-server"},
			{"mysql-server"},
		}
	}
	return softstoreAptInstallFirstAvailable(candidates...)
}

func softstoreAptUpdate() (string, error) {
	return runArgv([]string{"apt-get", "update"}, "")
}

// softstoreEnsureUbuntuUniverse best-effort enables the universe component so
// packages like mariadb-server become candidates on minimal Ubuntu cloud images.
func softstoreEnsureUbuntuUniverse() string {
	out, err := runArgv([]string{"bash", "-lc", `
. /etc/os-release 2>/dev/null || true
case "${ID:-}" in
  ubuntu)
    if command -v add-apt-repository >/dev/null 2>&1; then
      add-apt-repository -y universe 2>/dev/null || true
    fi
    if [ -f /etc/apt/sources.list ]; then
      sed -i 's/^deb \(.*\) main restricted$/deb \1 main restricted universe/g' /etc/apt/sources.list 2>/dev/null || true
      sed -i 's/^deb \(.*\) main$/deb \1 main universe/g' /etc/apt/sources.list 2>/dev/null || true
    fi
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then
      sed -i 's/Components: main restricted$/Components: main restricted universe/g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true
      sed -i 's/Components: main$/Components: main universe/g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true
    fi
    ;;
esac
apt-get update
`}, "")
	if err != nil {
		return out + "\n" + err.Error()
	}
	return out
}

func softstoreAptInstall(pkgs ...string) (string, error) {
	updateOut, _ := softstoreAptUpdate()
	argv := append([]string{"apt-get", "install", "-y"}, pkgs...)
	out, err := runArgv(argv, "")
	combined := strings.TrimSpace(updateOut + "\n" + out)
	return combined, err
}

func softstoreAptPackageMissing(log string) bool {
	return strings.Contains(log, "no installation candidate") ||
		strings.Contains(log, "Unable to locate package") ||
		strings.Contains(log, "has no installation candidate")
}

func softstoreAptInstallFirstAvailable(candidates ...[]string) (string, error) {
	var logs []string
	logs = append(logs, softstoreEnsureUbuntuUniverse())

	var lastErr error
	for _, pkgs := range candidates {
		argv := append([]string{"apt-get", "install", "-y"}, pkgs...)
		out, err := runArgv(argv, "")
		logs = append(logs, "try "+strings.Join(pkgs, " ")+":\n"+out)
		if err == nil {
			logs = append(logs, "installed: "+strings.Join(pkgs, " "))
			return strings.Join(logs, "\n"), nil
		}
		lastErr = err
		if softstoreAptPackageMissing(out) {
			continue
		}
		// Real install failure (deps/conflict) — stop
		return strings.Join(logs, "\n"), err
	}
	if lastErr == nil {
		lastErr = errSoftstore("no installation candidate for database server packages")
	}
	return strings.Join(logs, "\n"), lastErr
}

func softstoreEnableService(unit string) error {
	_, err := runArgv([]string{"systemctl", "enable", "--now", unit}, "")
	return err
}

func softstoreInstallPHP(ver string) (string, error) {
	pkgs := []string{
		"php" + ver + "-fpm",
		"php" + ver + "-cli",
		"php" + ver + "-mysql",
		"php" + ver + "-xml",
		"php" + ver + "-curl",
		"php" + ver + "-zip",
		"php" + ver + "-mbstring",
		"php" + ver + "-gd",
	}
	unit := "php" + ver + "-fpm"
	if softstoreSystemdActive(unit) {
		return unit + " already active", nil
	}
	out, err := softstoreAptInstall(pkgs...)
	if err != nil {
		return out, err
	}
	_ = softstoreEnableService(unit)
	return out, nil
}

func softstoreEnsureUFWBaseline() (string, error) {
	var logs []string
	if _, err := exec.LookPath("ufw"); err != nil {
		out, err := softstoreAptInstall("ufw")
		logs = append(logs, out)
		if err != nil {
			return strings.Join(logs, "\n"), err
		}
	}
	steps := [][]string{
		{"ufw", "default", "deny", "incoming"},
		{"ufw", "default", "allow", "outgoing"},
		{"ufw", "allow", "22/tcp"},
		{"ufw", "allow", "80/tcp"},
		{"ufw", "allow", "443/tcp"},
		{"ufw", "allow", "2090/tcp"},
	}
	for _, argv := range steps {
		out, err := runArgv(argv, "")
		logs = append(logs, out)
		if err != nil {
			// Non-fatal for default rules if already set; continue.
			logs = append(logs, fmt.Sprintf("warn: %v", err))
		}
	}
	out, err := runArgv([]string{"ufw", "--force", "enable"}, "")
	logs = append(logs, out)
	if err != nil {
		return strings.Join(logs, "\n"), err
	}
	return strings.Join(logs, "\n"), nil
}
