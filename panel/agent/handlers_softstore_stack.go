package main

import (
	"fmt"
	"strconv"
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
		installed, detail = softstoreProbeBins("mysqld", "mariadbd")
		if !installed {
			installed = softstoreSystemdActive("mysql") || softstoreSystemdActive("mysqld") || softstoreSystemdActive("mariadb")
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
	// Debian/Ubuntu: /usr/sbin/php-fpm8.2 ; some images also ship php8.2 CLI only.
	for _, bin := range []string{"php-fpm" + ver, "php" + ver} {
		if path, err := softstoreHostLookPath(bin); err == nil {
			return true, path, true
		}
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
		if path, err := softstoreHostLookPath("nginx"); err == nil {
			if err := softstoreEnableService("nginx"); err != nil {
				return "nginx present but not active: " + path + "\n" + err.Error(), err
			}
			return "nginx already present: " + path, nil
		}
		out, err := softstoreAptInstall("nginx")
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("nginx"); err != nil {
			return out + "\n" + err.Error(), err
		}
		return out, nil
	case "install_apache":
		if path, err := softstoreHostLookPath("apache2"); err == nil {
			if err := softstoreEnableService("apache2"); err != nil {
				return "apache2 present but not active: " + path + "\n" + err.Error(), err
			}
			return "apache2 already present: " + path, nil
		}
		out, err := softstoreAptInstall("apache2")
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("apache2"); err != nil {
			return out + "\n" + err.Error(), err
		}
		return out, nil
	case "install_mariadb":
		if softstoreSystemdActive("mariadb") || softstoreSystemdActive("mysql") {
			return "mariadb/mysql already active", nil
		}
		out, err := softstoreInstallDatabaseServer("mariadb")
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("mariadb"); err != nil {
			if err2 := softstoreEnableService("mysql"); err2 != nil {
				return out + "\n" + err.Error() + "\n" + err2.Error(), err2
			}
		}
		return out, nil
	case "install_mysql":
		if softstoreSystemdActive("mysql") || softstoreSystemdActive("mysqld") || softstoreSystemdActive("mariadb") {
			return "mysql/mariadb already active", nil
		}
		out, err := softstoreInstallDatabaseServer("mysql")
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("mysql"); err != nil {
			if err2 := softstoreEnableService("mariadb"); err2 != nil {
				return out + "\n" + err.Error() + "\n" + err2.Error(), err2
			}
		}
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
		if path, err := softstoreHostLookPath("pure-ftpd"); err == nil {
			_ = softstoreEnableService("pure-ftpd")
			_ = softstoreAllowFTPFirewall()
			return "pure-ftpd already present: " + path, nil
		}
		out, err := softstoreAptInstallFirstAvailable(
			[]string{"pure-ftpd"},
			[]string{"pure-ftpd-common", "pure-ftpd"},
		)
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("pure-ftpd"); err != nil {
			return out + "\n" + err.Error(), err
		}
		_ = softstoreAllowFTPFirewall()
		return out, nil
	case "ensure_ufw_baseline":
		return softstoreEnsureUFWBaseline()
	case "ensure_fail2ban":
		if path, err := softstoreHostLookPath("fail2ban-client"); err == nil {
			if err := softstoreEnableService("fail2ban"); err != nil {
				return "fail2ban present but not active: " + path + "\n" + err.Error(), err
			}
			return "fail2ban already present: " + path, nil
		}
		out, err := softstoreAptInstall("fail2ban")
		if err != nil {
			return out, err
		}
		if err := softstoreEnableService("fail2ban"); err != nil {
			return out + "\n" + err.Error(), err
		}
		return out, nil
	default:
		return "", errSoftstore("unknown stack script")
	}
}

func softstoreAllowFTPFirewall() error {
	if _, err := softstoreHostLookPath("ufw"); err != nil {
		return nil
	}
	_, _ = softstoreAptRun([]string{"ufw", "allow", "21/tcp"})
	_, err := softstoreAptRun([]string{"ufw", "allow", "30000:30100/tcp"})
	return err
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

// softstoreEnsureUbuntuUniverse best-effort enables the universe component so
// packages like mariadb-server, redis-server, fail2ban, pure-ftpd, composer
// become candidates on minimal Ubuntu cloud images.
func softstoreEnsureUbuntuUniverse() string {
	out, err := softstoreBash(`
. /etc/os-release 2>/dev/null || true
case "${ID:-}" in
  ubuntu)
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq software-properties-common ca-certificates 2>/dev/null || true
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
`)
	if err != nil {
		return out + "\n" + err.Error()
	}
	return out
}

// softstoreEnsureExtraPHPRepos adds third-party PHP repos when distro packages
// are missing: Ubuntu → ppa:ondrej/php ; Debian → packages.sury.org/php.
func softstoreEnsureExtraPHPRepos() string {
	var logs []string
	logs = append(logs, softstoreEnsureUbuntuUniverse())
	out, err := softstoreBash(`
. /etc/os-release 2>/dev/null || true
export DEBIAN_FRONTEND=noninteractive
case "${ID:-}" in
  ubuntu)
    apt-get install -y -qq software-properties-common ca-certificates apt-transport-https curl 2>/dev/null || true
    if command -v add-apt-repository >/dev/null 2>&1; then
      add-apt-repository -y ppa:ondrej/php 2>/dev/null || true
    fi
    apt-get update
    ;;
  debian)
    apt-get install -y -qq lsb-release ca-certificates curl 2>/dev/null || true
    curl -fsSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
    dpkg -i /tmp/debsuryorg-archive-keyring.deb
    rm -f /tmp/debsuryorg-archive-keyring.deb
    codename="$(lsb_release -sc 2>/dev/null || true)"
    if [ -z "$codename" ]; then
      . /etc/os-release 2>/dev/null || true
      codename="${VERSION_CODENAME:-bookworm}"
    fi
    echo "deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ ${codename} main" > /etc/apt/sources.list.d/php-sury.list
    apt-get update
    ;;
  *)
    apt-get update
    ;;
esac
`)
	logs = append(logs, out)
	if err != nil {
		logs = append(logs, err.Error())
	}
	return strings.Join(logs, "\n")
}

func softstoreAptRun(argv []string) (string, error) {
	return runArgvEnv(softstoreHostArgv(argv), map[string]string{"DEBIAN_FRONTEND": "noninteractive"})
}

func softstoreAptInstallCmd(pkgs ...string) []string {
	return append([]string{
		"apt-get", "install", "-y",
		"-o", "Dpkg::Options::=--force-confdef",
		"-o", "Dpkg::Options::=--force-confold",
	}, pkgs...)
}

func softstoreAptInstall(pkgs ...string) (string, error) {
	updateOut := softstoreEnsureUbuntuUniverse()
	out, err := softstoreAptRun(softstoreAptInstallCmd(pkgs...))
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
		out, err := softstoreAptRun(softstoreAptInstallCmd(pkgs...))
		logs = append(logs, "try "+strings.Join(pkgs, " ")+":\n"+out)
		if err == nil {
			logs = append(logs, "installed: "+strings.Join(pkgs, " "))
			return strings.Join(logs, "\n"), nil
		}
		lastErr = err
		if softstoreAptPackageMissing(out) {
			continue
		}
		return strings.Join(logs, "\n"), err
	}
	if lastErr == nil {
		lastErr = errSoftstore("no installation candidate for requested packages")
	}
	return strings.Join(logs, "\n"), lastErr
}

func softstoreEnableService(unit string) error {
	out, err := softstoreAptRun([]string{"systemctl", "enable", "--now", unit})
	if err == nil && softstoreSystemdActive(unit) {
		return nil
	}
	out2, err2 := softstoreAptRun([]string{"systemctl", "start", unit})
	if softstoreSystemdActive(unit) {
		return nil
	}
	msg := fmt.Sprintf("unit %s not active after enable/start", unit)
	if err != nil {
		msg += fmt.Sprintf("; enable: %v (%s)", err, strings.TrimSpace(out))
	}
	if err2 != nil {
		msg += fmt.Sprintf("; start: %v (%s)", err2, strings.TrimSpace(out2))
	}
	return errSoftstore(msg)
}

func softstoreAptCacheHas(pkg string) bool {
	out, err := softstoreBash(`apt-cache show ` + strconv.Quote(pkg) + ` 2>/dev/null | head -n1`)
	return err == nil && strings.Contains(out, "Package:")
}

func softstoreInstallPHP(ver string) (string, error) {
	core := []string{
		"php" + ver + "-fpm",
		"php" + ver + "-cli",
	}
	exts := []string{
		"php" + ver + "-mysql",
		"php" + ver + "-xml",
		"php" + ver + "-curl",
		"php" + ver + "-zip",
		"php" + ver + "-mbstring",
		"php" + ver + "-gd",
		"php" + ver + "-intl",
		"php" + ver + "-bcmath",
	}
	pkgs := append(append([]string{}, core...), exts...)
	unit := "php" + ver + "-fpm"
	if softstoreSystemdActive(unit) {
		return unit + " already active", nil
	}

	var logs []string
	// Bookworm only ships 8.2 by default; 8.1/8.3/8.4 need Sury/Ondřej before apt.
	if !softstoreAptCacheHas("php" + ver + "-fpm") {
		logs = append(logs, softstoreEnsureExtraPHPRepos())
	}

	out, err := softstoreAptInstall(pkgs...)
	logs = append(logs, out)
	if err != nil && softstoreAptPackageMissing(out) {
		logs = append(logs, softstoreEnsureExtraPHPRepos())
		out2, err2 := softstoreAptInstall(pkgs...)
		logs = append(logs, out2)
		err = err2
		out = out2
	}
	if err != nil && softstoreAptPackageMissing(out) {
		// Last resort: core packages only, then best-effort extensions.
		outCore, errCore := softstoreAptInstall(core...)
		logs = append(logs, outCore)
		if errCore != nil {
			return strings.Join(logs, "\n"), errCore
		}
		outExt, extErr := softstoreAptInstall(exts...)
		logs = append(logs, outExt)
		if extErr != nil {
			logs = append(logs, "warn: some PHP extensions failed: "+extErr.Error())
		}
		err = nil
	}
	if err != nil {
		return strings.Join(logs, "\n"), err
	}
	if err := softstoreEnableService(unit); err != nil {
		// Packages installed; surface unit failure so wizard can retry enable.
		logs = append(logs, err.Error())
		return strings.Join(logs, "\n"), err
	}
	return strings.Join(logs, "\n"), nil
}

func softstoreEnsureComposer() (string, error) {
	if path, err := softstoreHostLookPath("composer"); err == nil {
		return "composer already present: " + path, nil
	}
	out, err := softstoreAptInstall("composer")
	if err == nil {
		if path, lookErr := softstoreHostLookPath("composer"); lookErr == nil {
			return out + "\ncomposer at " + path, nil
		}
		return out, nil
	}
	// Distro package often missing; install official PHAR.
	fallback, ferr := softstoreBash(`
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y php-cli php-xml php-mbstring php-curl unzip curl ca-certificates
curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer --quiet
rm -f /tmp/composer-setup.php
composer --version
`)
	combined := strings.TrimSpace(out + "\n" + fallback)
	if ferr != nil {
		return combined, ferr
	}
	return combined, nil
}

func softstoreInstallRedis() (string, error) {
	if softstoreSystemdActive("redis-server") || softstoreSystemdActive("redis") {
		return "redis already active", nil
	}
	if path, err := softstoreHostLookPath("redis-server"); err == nil {
		if err := softstoreEnableService("redis-server"); err != nil {
			_ = softstoreEnableService("redis")
			if !softstoreSystemdActive("redis-server") && !softstoreSystemdActive("redis") {
				return "redis-server present but not active: " + path + "\n" + err.Error(), err
			}
		}
		return "redis-server already present: " + path, nil
	}
	out, err := softstoreAptInstallFirstAvailable(
		[]string{"redis-server"},
		[]string{"redis"},
	)
	if err != nil {
		return out, err
	}
	if err := softstoreEnableService("redis-server"); err != nil {
		if err2 := softstoreEnableService("redis"); err2 != nil {
			return out + "\n" + err.Error() + "\n" + err2.Error(), err2
		}
	}
	return out, nil
}

func softstoreInstallMemcached() (string, error) {
	if softstoreSystemdActive("memcached") {
		return "memcached already active", nil
	}
	if path, err := softstoreHostLookPath("memcached"); err == nil {
		if err := softstoreEnableService("memcached"); err != nil {
			return "memcached present but not active: " + path + "\n" + err.Error(), err
		}
		return "memcached already present: " + path, nil
	}
	out, err := softstoreAptInstall("memcached")
	if err != nil {
		return out, err
	}
	if err := softstoreEnableService("memcached"); err != nil {
		return out + "\n" + err.Error(), err
	}
	return out, nil
}

func softstoreEnsureUFWBaseline() (string, error) {
	var logs []string
	if _, err := softstoreHostLookPath("ufw"); err != nil {
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
		out, err := softstoreAptRun(argv)
		logs = append(logs, out)
		if err != nil {
			logs = append(logs, fmt.Sprintf("warn: %v", err))
		}
	}
	out, err := softstoreAptRun([]string{"ufw", "--force", "enable"})
	logs = append(logs, out)
	if err != nil {
		return strings.Join(logs, "\n"), err
	}
	return strings.Join(logs, "\n"), nil
}
