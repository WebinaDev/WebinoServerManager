package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSearchFilesFindsName(t *testing.T) {
	root := t.TempDir()
	filesRoot = root
	if err := os.WriteFile(filepath.Join(root, "hello.txt"), []byte("alpha"), 0o644); err != nil {
		t.Fatal(err)
	}
	hits := searchFiles(root, "hello", 2, 10)
	if len(hits) == 0 {
		t.Fatal("expected hit")
	}
}

func TestSaveFileVersionKeepsHistory(t *testing.T) {
	root := t.TempDir()
	filesRoot = root
	os.Setenv("WEBINO_VERSIONS_ROOT", filepath.Join(root, ".versions"))
	path := filepath.Join(root, "f.txt")
	if err := os.WriteFile(path, []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := saveFileVersion(path); err != nil {
		t.Fatal(err)
	}
	dir := versionDirFor(path)
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 {
		t.Fatalf("entries=%v err=%v", entries, err)
	}
}
