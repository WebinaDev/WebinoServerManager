package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWordpressUnknownAction(t *testing.T) {
	filesRoot = t.TempDir()
	req := httptest.NewRequest(http.MethodPost, "/v1/wordpress", strings.NewReader(`{"action":"bogus","path":"sites/x"}`))
	rec := httptest.NewRecorder()
	handleWordpress(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestWordpressCloneRequiresTarget(t *testing.T) {
	filesRoot = t.TempDir()
	req := httptest.NewRequest(http.MethodPost, "/v1/wordpress", strings.NewReader(`{"action":"clone","path":"sites/a"}`))
	rec := httptest.NewRecorder()
	handleWordpress(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestWordpressMigrateRequiresURLs(t *testing.T) {
	filesRoot = t.TempDir()
	siteDir := filepath.Join(filesRoot, "sites", "blog")
	if err := os.MkdirAll(siteDir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := `{"action":"migrate","path":"sites/blog","old_url":"","new_url":"https://new.example"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/wordpress", bodyReader(body))
	rec := httptest.NewRecorder()
	handleWordpress(rec, req)
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if env.OK {
		t.Fatal("expected migrate without old_url to fail")
	}
}

func TestCopyWordpressTree(t *testing.T) {
	filesRoot = t.TempDir()
	src := filepath.Join(filesRoot, "src")
	dst := filepath.Join(filesRoot, "dst")
	if err := os.MkdirAll(src, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "wp-config.php"), []byte("<?php"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := copyWordpressTree(src, dst); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dst, "wp-config.php")); err != nil {
		t.Fatalf("expected copied wp-config.php: %v", err)
	}
}

func TestRuntimeBuildArgvNode(t *testing.T) {
	argv, err := runtimeBuildArgv("node", "server.js", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(argv) != 2 || argv[0] != "node" || argv[1] != "server.js" {
		t.Fatalf("unexpected argv: %#v", argv)
	}
}

func TestRuntimeBuildArgvNpm(t *testing.T) {
	argv, err := runtimeBuildArgv("node", "", "start")
	if err != nil {
		t.Fatal(err)
	}
	if len(argv) != 3 || argv[0] != "npm" {
		t.Fatalf("unexpected argv: %#v", argv)
	}
}

func TestRuntimesInstallAllowlist(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/runtimes/install", strings.NewReader(`{"script_id":"evil_shell"}`))
	rec := httptest.NewRecorder()
	handleRuntimesInstall(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestRuntimesStatusGet(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/runtimes/status", nil)
	rec := httptest.NewRecorder()
	handleRuntimesStatus(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if !env.OK {
		t.Fatalf("expected ok: %s", env.Error)
	}
}

func TestRuntimesProjectInvalidName(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/runtimes/projects", strings.NewReader(`{"action":"start","name":"bad name","runtime":"node","work_dir":"apps/x"}`))
	rec := httptest.NewRecorder()
	handleRuntimesProjects(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func bodyReader(s string) *strings.Reader {
	return strings.NewReader(s)
}
