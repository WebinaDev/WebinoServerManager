package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseDuOutput(t *testing.T) {
	if got := parseDuOutput("42\t/var/www/user1"); got != 42 {
		t.Fatalf("expected 42, got %d", got)
	}
	if got := parseDuOutput(""); got != 0 {
		t.Fatalf("expected 0 for empty, got %d", got)
	}
}

func TestHostingHomePath(t *testing.T) {
	hostingHomes = "/var/www"
	got := hostingHomePath("user1")
	if got != "/var/www/user1" {
		t.Fatalf("unexpected path: %s", got)
	}
	if hostingHomePath("../etc") != "/var/www/etc" {
		t.Fatalf("should strip traversal")
	}
}

func TestHandleHostingUsageMissingAccount(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/hosting/usage", nil)
	rec := httptest.NewRecorder()
	handleHostingUsage(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
