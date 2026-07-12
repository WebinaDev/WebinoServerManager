package main

import (
	"strings"
	"testing"
)

func TestBuildDkimTxtRecord(t *testing.T) {
	txt := buildDkimTxtRecord("default", "ABC123")
	if !strings.Contains(txt, "v=DKIM1") || !strings.Contains(txt, "p=ABC123") {
		t.Fatalf("unexpected txt: %s", txt)
	}
}

func TestBuildVacationSieve(t *testing.T) {
	s := buildVacationSieve("Away", "On vacation")
	if !strings.Contains(s, "vacation") || !strings.Contains(s, "Away") {
		t.Fatalf("unexpected sieve: %s", s)
	}
}

func TestParsePostqueue(t *testing.T) {
	out := `-Queue ID-  --Size-- ----Arrival Time---- -Sender/Recipient-------
A1B2C3D4E5    1024 Mon Jul  5 12:00:00  sender@example.com
                                         recipient@example.com`
	entries := parsePostqueue(out)
	if len(entries) < 1 {
		t.Fatalf("expected entries, got %d", len(entries))
	}
}

func TestParseDoveadmQuota(t *testing.T) {
	out := `User quota STORAGE 1048576 5242880`
	q := parseDoveadmQuota(out)
	if q["used_bytes"] == nil {
		t.Fatal("expected used_bytes")
	}
}
