package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func makeTicket(token string, uid int64, exp int64) string {
	payload, _ := json.Marshal(ticketPayload{UID: uid, Exp: exp})
	payloadB64 := base64.StdEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(token))
	mac.Write([]byte(payloadB64))
	sig := hex.EncodeToString(mac.Sum(nil))

	return payloadB64 + "." + sig
}

func TestSafeGitPathJail(t *testing.T) {
	gitRoot = t.TempDir()
	inside, err := safeGitPath("project/app")
	if err != nil {
		t.Fatalf("expected inside path: %v", err)
	}
	if !strings.HasPrefix(inside, gitRoot) {
		t.Fatalf("path %q outside jail %q", inside, gitRoot)
	}
	if _, err := safeGitPath("../../etc/passwd"); err == nil {
		t.Fatal("expected jail escape to fail")
	}
}

func TestSafeFilePathJail(t *testing.T) {
	filesRoot = t.TempDir()
	inside, err := safeFilePath("sites/demo")
	if err != nil {
		t.Fatalf("expected inside path: %v", err)
	}
	if !strings.HasPrefix(inside, filesRoot) {
		t.Fatalf("path %q outside jail %q", inside, filesRoot)
	}
}

func TestHandleGitCreateValidation(t *testing.T) {
	gitRoot = t.TempDir()
	req := httptest.NewRequest(http.MethodPost, "/v1/git", strings.NewReader(`{"action":"create"}`))
	rec := httptest.NewRecorder()
	handleGit(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandleGitListGet(t *testing.T) {
	gitRoot = t.TempDir()
	repoDir := filepath.Join(gitRoot, "demo")
	if err := os.MkdirAll(filepath.Join(repoDir, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/git", nil)
	rec := httptest.NewRecorder()
	handleGit(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if !env.OK {
		t.Fatalf("expected ok response: %s", env.Error)
	}
}

func TestHandleWordpressListGet(t *testing.T) {
	filesRoot = t.TempDir()
	siteDir := filepath.Join(filesRoot, "sites", "blog")
	if err := os.MkdirAll(siteDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(siteDir, "wp-config.php"), []byte("<?php"), 0o644); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/wordpress", nil)
	rec := httptest.NewRecorder()
	handleWordpress(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if !env.OK {
		t.Fatalf("expected ok response: %s", env.Error)
	}
}

func TestVerifyTicketRoundTrip(t *testing.T) {
	sharedToken = "test-secret"
	ticket := makeTicket("test-secret", 1, time.Now().Add(time.Minute).Unix())

	payload, err := verifyTicket(ticket)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if payload.UID != 1 {
		t.Fatalf("expected uid 1, got %d", payload.UID)
	}
}

func TestVerifyTicketRejectsExpired(t *testing.T) {
	sharedToken = "test-secret"
	ticket := makeTicket("test-secret", 1, time.Now().Add(-time.Minute).Unix())

	if _, err := verifyTicket(ticket); err == nil {
		t.Fatal("expected expired ticket to fail")
	}
}

func TestVerifyTicketRejectsGarbage(t *testing.T) {
	sharedToken = "test-secret"
	if _, err := verifyTicket("not-a-ticket"); err == nil {
		t.Fatal("expected error for garbage ticket")
	}
}
