package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindWorldWritable(t *testing.T) {
	root := t.TempDir()
	safe := filepath.Join(root, "ok.txt")
	if err := os.WriteFile(safe, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	ww := filepath.Join(root, "bad.txt")
	if err := os.WriteFile(ww, []byte("x"), 0o666); err != nil {
		t.Fatal(err)
	}
	hits := findWorldWritable(root, 2, 10)
	if len(hits) != 1 || hits[0] != ww {
		t.Fatalf("hits=%v", hits)
	}
}

func TestWafSiteNameRe(t *testing.T) {
	if !wafSiteNameRe.MatchString("example.com") {
		t.Fatal("expected fqdn ok")
	}
	if wafSiteNameRe.MatchString("../etc") {
		t.Fatal("expected reject traversal")
	}
}

func TestDirSizeLimited(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "a.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	n, err := dirSizeLimited(root, 2)
	if err != nil {
		t.Fatal(err)
	}
	if n != 5 {
		t.Fatalf("size=%d", n)
	}
}
