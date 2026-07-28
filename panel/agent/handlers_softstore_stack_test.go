package main

import (
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
