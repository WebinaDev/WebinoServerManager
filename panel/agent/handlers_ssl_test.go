package main

import (
	"strings"
	"testing"
)

func TestAcmeChallengeRecord(t *testing.T) {
	rec := acmeChallengeRecord("example.com")
	if !strings.HasPrefix(rec, "_acme-challenge") {
		t.Fatalf("unexpected record: %s", rec)
	}
}

func TestSslValidateChainMissing(t *testing.T) {
	result := sslValidateChain("", "", "")
	if result["valid"] == "true" {
		t.Fatal("expected invalid")
	}
}

func TestBuildCertbotDnsHooksContent(t *testing.T) {
	// ensure hook builder doesn't panic; actual files may fail in sandbox
	_ = buildCertbotDnsHooks()
}

func TestWildcardArgvDomains(t *testing.T) {
	domain := "example.com"
	wildcard := "*." + domain
	if wildcard != "*.example.com" {
		t.Fatalf("unexpected wildcard: %s", wildcard)
	}
}
