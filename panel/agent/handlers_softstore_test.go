package main

import (
	"testing"
)

func TestSoftstoreScriptAllowlist(t *testing.T) {
	if !softstoreScriptIDs["install_redis"] {
		t.Fatal("install_redis should be allowlisted")
	}
	if softstoreScriptIDs["rm_rf"] {
		t.Fatal("arbitrary script must not be allowlisted")
	}
}

func TestProbeSoftstorePackageUnknown(t *testing.T) {
	res := probeSoftstorePackage("not-a-real-pkg")
	if res["status"] != "available" {
		t.Fatalf("expected available for unknown, got %v", res)
	}
}
