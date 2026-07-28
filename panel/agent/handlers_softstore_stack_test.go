package main

import "testing"

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
	if softstoreAptPackageMissing("E: Unable to correct problems, you have held broken packages.") {
		t.Fatal("held broken packages is not a missing-candidate case")
	}
}

func TestSoftstoreInstallDatabaseServerCandidates(t *testing.T) {
	// sanity: preference order helpers compile / preference branches exist via allowlist
	if !softstoreIsStackScript("install_mariadb") || !softstoreIsStackScript("install_mysql") {
		t.Fatal("db install scripts must be stack scripts")
	}
}
