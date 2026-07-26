package main

import "testing"

func TestSoftstoreStackAllowlist(t *testing.T) {
	for id := range softstoreStackScriptIDs {
		if !softstoreScriptIDs[id] {
			t.Fatalf("stack script %q missing from softstoreScriptIDs", id)
		}
	}
}

func TestProbeSoftstoreStackPackage(t *testing.T) {
	_, _, ok := probeSoftstoreStackPackage("nginx")
	if !ok {
		t.Fatal("nginx probe should be recognized")
	}
	_, _, ok = probeSoftstoreStackPackage("php-fpm-83")
	if !ok {
		t.Fatal("php-fpm-83 probe should be recognized")
	}
	_, _, ok = probeSoftstoreStackPackage("not-a-real-pkg")
	if ok {
		t.Fatal("unknown package should not be recognized as stack")
	}
}
