package main

import (
	"strings"
	"testing"
)

func TestParseListZone(t *testing.T) {
	out := `example.com.	3600	IN	MX	10 mail.example.com.
www.example.com.	3600	IN	A	192.0.2.1`
	records := parseListZone(out)
	if len(records) < 2 {
		t.Fatalf("expected at least 2 records, got %d", len(records))
	}
	if records[0].Type != "MX" || records[0].Priority != "10" {
		t.Fatalf("unexpected MX record: %+v", records[0])
	}
}

func TestTemplateRecords(t *testing.T) {
	recs := templateRecords("web_hosting", "example.com")
	if len(recs) != 3 {
		t.Fatalf("expected 3 template records, got %d", len(recs))
	}
}

func TestPtrZoneFromIP(t *testing.T) {
	zone := ptrZoneFromIP("192.0.2.1")
	if !strings.HasSuffix(zone, "in-addr.arpa") {
		t.Fatalf("unexpected ptr zone: %s", zone)
	}
	if zone != "1.2.0.192.in-addr.arpa" {
		t.Fatalf("wrong ptr zone: %s", zone)
	}
}
