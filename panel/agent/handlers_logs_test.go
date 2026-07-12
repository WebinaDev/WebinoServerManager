package main

import "testing"

func TestIsAllowedLogSource(t *testing.T) {
	if !isAllowedLogSource("nginx-error") {
		t.Fatal("nginx-error should be allowed")
	}
	if isAllowedLogSource("etc-passwd") {
		t.Fatal("arbitrary source should be rejected")
	}
}
