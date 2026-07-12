package main

import (
	"strings"
	"testing"
)

func TestBuildPdnsRecordArgs(t *testing.T) {
	args := buildPdnsRecordArgs("example.com", "www", "A", "300", "192.0.2.1", "")
	if len(args) != 7 || args[6] != "192.0.2.1" {
		t.Fatalf("unexpected A args: %v", args)
	}

	mx := buildPdnsRecordArgs("example.com", "@", "MX", "", "mail.example.com", "10")
	if mx[6] != "10 mail.example.com" {
		t.Fatalf("expected priority in MX content, got %q", mx[6])
	}

	def := buildPdnsRecordArgs("example.com", "www", "A", "", "192.0.2.2", "")
	if def[5] != "3600" {
		t.Fatalf("expected default ttl 3600, got %q", def[5])
	}
}

func TestFormatMailMapLine(t *testing.T) {
	line := formatMailMapLine("user@example.com", "example.com/user/")
	if line != "user@example.com example.com/user/" {
		t.Fatalf("unexpected line: %q", line)
	}
}

func TestSubdomainDocrootJail(t *testing.T) {
	filesRoot = t.TempDir()
	inside, err := safeFilePath("sites/demo.example.com/public")
	if err != nil {
		t.Fatalf("expected inside path: %v", err)
	}
	if !strings.HasPrefix(inside, filesRoot) {
		t.Fatalf("path %q outside jail %q", inside, filesRoot)
	}
	if _, err := safeFilePath("../../etc/passwd"); err == nil {
		t.Fatal("expected jail escape to fail")
	}
}
