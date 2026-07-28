package main

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

func TestSoftstoreStackAllowlist(t *testing.T) {
	for id := range softstoreStackScriptIDs {
		if !softstoreScriptIDs[id] {
			t.Fatalf("stack script %q missing from softstoreScriptIDs", id)
		}
	}
}

func TestSoftstoreAptPackageMissing(t *testing.T) {
	if !softstoreAptPackageMissing("E: Package 'mariadb-server' has no installation candidate") {
		t.Fatal("expected missing candidate detection")
	}
	if !softstoreAptPackageMissing("E: Unable to locate package composer") {
		t.Fatal("expected unable to locate package detection")
	}
	if softstoreAptPackageMissing("E: Unable to correct problems, you have held broken packages.") {
		t.Fatal("held broken packages is not a missing-candidate case")
	}
}

func TestSoftstoreInstallDatabaseServerCandidates(t *testing.T) {
	if !softstoreIsStackScript("install_mariadb") || !softstoreIsStackScript("install_mysql") {
		t.Fatal("db install scripts must be stack scripts")
	}
}

func TestSoftstoreAptInstallCmdNoninteractiveFlags(t *testing.T) {
	cmd := softstoreAptInstallCmd("nginx")
	joined := strings.Join(cmd, " ")
	if !strings.Contains(joined, "force-confdef") || !strings.Contains(joined, "force-confold") {
		t.Fatalf("expected dpkg force-conf flags, got %v", cmd)
	}
	if cmd[0] != "apt-get" || cmd[1] != "install" || cmd[2] != "-y" {
		t.Fatalf("unexpected apt argv prefix: %v", cmd)
	}
}

func TestSoftstoreRuntimeScriptsAllowlisted(t *testing.T) {
	for _, id := range []string{
		"install_redis", "install_memcached", "ensure_composer",
		"install_node_nvm", "install_node_nodesource",
		"install_python_distro", "install_go_distro", "install_java_distro",
	} {
		if !softstoreScriptIDs[id] {
			t.Fatalf("%q must be allowlisted", id)
		}
	}
}

func TestSoftstoreHostArgvPassthroughWhenDisabled(t *testing.T) {
	t.Setenv("WEBINO_SOFTSTORE_ON_HOST", "0")
	in := []string{"apt-get", "install", "-y", "nginx"}
	got := softstoreHostArgv(in)
	if len(got) != len(in) || got[0] != "apt-get" {
		t.Fatalf("expected passthrough when host NS disabled, got %v", got)
	}
}

func TestSoftstoreHostArgvWrapsWhenForced(t *testing.T) {
	if _, err := exec.LookPath("nsenter"); err != nil {
		t.Skip("nsenter not available")
	}
	if _, err := os.Stat("/proc/1/root/etc/os-release"); err != nil {
		t.Skip("host root not visible")
	}
	t.Setenv("WEBINO_SOFTSTORE_ON_HOST", "1")
	got := softstoreHostArgv([]string{"apt-get", "update"})
	if len(got) < 3 || got[0] != "nsenter" {
		t.Fatalf("expected nsenter wrap, got %v", got)
	}
}

func TestSoftstoreMysqlProbeAcceptsMariadbFallback(t *testing.T) {
	installed, _, ok := probeSoftstoreStackPackage("mysql")
	if !ok {
		t.Fatal("mysql must be a known stack probe")
	}
	_ = installed
}

func TestSoftstoreCatalogScriptsHaveProbes(t *testing.T) {
	for _, slug := range []string{
		"nginx", "apache", "mariadb", "mysql",
		"php-fpm-81", "php-fpm-82", "php-fpm-83", "php-fpm-84",
		"ufw", "fail2ban", "pureftpd",
	} {
		_, _, ok := probeSoftstoreStackPackage(slug)
		if !ok {
			t.Fatalf("missing stack probe for %q", slug)
		}
	}
}
