package main

import "testing"

func TestIsAllowedService(t *testing.T) {
	if !isAllowedService("nginx") {
		t.Fatal("nginx should be allowed")
	}
	if isAllowedService("unknown-svc") {
		t.Fatal("unknown should be rejected")
	}
}
