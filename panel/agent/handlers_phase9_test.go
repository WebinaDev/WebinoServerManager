package main

import (
	"strings"
	"testing"
	"time"
)

func TestFilterSystemDatabases(t *testing.T) {
	names := []string{"webinoserver", "mysql", "information_schema", "app_db"}
	filtered := filterSystemDatabases(names)
	if len(filtered) != 2 {
		t.Fatalf("expected 2 databases, got %d", len(filtered))
	}
}

func TestParseOpenSSLEnddate(t *testing.T) {
	out := "notAfter=Jul  5 12:00:00 2026 GMT\n"
	tm, ok := parseOpenSSLEnddate(out)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if tm.Year() != 2026 {
		t.Fatalf("expected 2026 got %d", tm.Year())
	}
}

func TestBuildPhpPoolConf(t *testing.T) {
	conf := buildPhpPoolConf("pool1", "8.3", "example.com", map[string]any{
		"pm.max_children": 10,
		"memory_limit":    "256M",
	})
	if !strings.Contains(conf, "pm.max_children = 10") {
		t.Fatal("missing pm.max_children")
	}
	if !strings.Contains(conf, "php_admin_value[memory_limit] = 256M") {
		t.Fatal("missing memory_limit")
	}
}

func TestFormatMailQuotaRule(t *testing.T) {
	rule := formatMailQuotaRule(1024)
	if rule != "quota_rule = *:storage=1024M" {
		t.Fatalf("unexpected rule: %q", rule)
	}
	if formatMailQuotaRule(0) != "" {
		t.Fatal("zero quota should be empty")
	}
}

func TestCertExpiryFallback(t *testing.T) {
	exp := certExpiryForDomain("nonexistent.example.test")
	tm, err := time.Parse(time.RFC3339, exp)
	if err != nil {
		t.Fatalf("invalid RFC3339: %v", err)
	}
	if tm.Before(time.Now()) {
		t.Fatal("fallback expiry should be in future")
	}
}
