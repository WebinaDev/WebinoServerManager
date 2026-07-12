package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSafeFilePathSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	filesRoot = root

	insideDir := filepath.Join(root, "sites")
	if err := os.MkdirAll(insideDir, 0o755); err != nil {
		t.Fatal(err)
	}

	outside := t.TempDir()
	outsideFile := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	linkPath := filepath.Join(insideDir, "evil")
	if err := os.Symlink(outside, linkPath); err != nil {
		t.Skip("symlink not supported in test environment")
	}

	if _, err := safeFilePath("sites/evil/secret.txt"); err == nil {
		t.Fatal("expected symlink escape to fail")
	}
}

func TestCrontabArgvIncludesUserFlag(t *testing.T) {
	argv := crontabArgv("siteuser", "-l")
	want := []string{"crontab", "-u", "siteuser", "-l"}
	if len(argv) != len(want) {
		t.Fatalf("argv len %d want %d", len(argv), len(want))
	}
	for i := range want {
		if argv[i] != want[i] {
			t.Fatalf("argv[%d]=%q want %q", i, argv[i], want[i])
		}
	}
}

func TestCrontabArgvWithoutUser(t *testing.T) {
	argv := crontabArgv("", "-l")
	if len(argv) != 2 || argv[0] != "crontab" || argv[1] != "-l" {
		t.Fatalf("unexpected argv: %v", argv)
	}
}

func TestSafeFilePathInsideJail(t *testing.T) {
	root := t.TempDir()
	filesRoot = root

	dir := filepath.Join(root, "sites", "demo")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	got, err := safeFilePath("sites/demo")
	if err != nil {
		t.Fatalf("expected valid path: %v", err)
	}
	if !filepath.IsAbs(got) {
		t.Fatalf("expected absolute path, got %q", got)
	}
}
