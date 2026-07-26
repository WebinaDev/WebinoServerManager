package main

import "testing"

func TestParseAlidnsCredentials(t *testing.T) {
	id, secret, err := parseAlidnsCredentials("AKIDabc:secret123")
	if err != nil || id != "AKIDabc" || secret != "secret123" {
		t.Fatalf("colon parse failed: %v %q %q", err, id, secret)
	}
	id, secret, err = parseAlidnsCredentials("AKIDabc|secret123")
	if err != nil || id != "AKIDabc" || secret != "secret123" {
		t.Fatalf("pipe parse failed: %v %q %q", err, id, secret)
	}
	if _, _, err := parseAlidnsCredentials("onlyone"); err == nil {
		t.Fatal("expected error for malformed token")
	}
}

func TestAlidnsRR(t *testing.T) {
	cases := []struct {
		domain, name, want string
	}{
		{"example.com", "@", "@"},
		{"example.com", "example.com", "@"},
		{"example.com", "_acme-challenge.example.com", "_acme-challenge"},
		{"example.com", "www", "www"},
		{"example.com", "www.example.com", "www"},
	}
	for _, tc := range cases {
		if got := alidnsRR(tc.domain, tc.name); got != tc.want {
			t.Fatalf("alidnsRR(%q,%q)=%q want %q", tc.domain, tc.name, got, tc.want)
		}
	}
}

func TestRuntimeBuildArgvJava(t *testing.T) {
	argv, err := runtimeBuildArgv("java", "app.jar", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(argv) != 3 || argv[0] != "java" || argv[1] != "-jar" || argv[2] != "app.jar" {
		t.Fatalf("unexpected jar argv: %#v", argv)
	}
	argv, err = runtimeBuildArgv("java", "Main", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(argv) != 2 || argv[0] != "java" || argv[1] != "Main" {
		t.Fatalf("unexpected class argv: %#v", argv)
	}
}
