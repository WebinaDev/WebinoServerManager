package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLoginWith2FA(t *testing.T) {
	secret := "test-secret-otp"
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/login" {
			http.NotFound(w, r)
			return
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		attempts++
		if body["otp"] != secret {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"two_factor_required":true,"message":"2FA required"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"tok-abc"}`))
	}))
	defer srv.Close()

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("WPANEL_OTP", secret)

	if err := cmdLogin(srv.URL, "admin", "pass"); err != nil {
		t.Fatalf("cmdLogin: %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 login attempts, got %d", attempts)
	}

	cfgPath := filepath.Join(home, ".config", "wpanel", "config.json")
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	var cfg config
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Token != "tok-abc" {
		t.Fatalf("expected token tok-abc, got %q", cfg.Token)
	}
}

func TestLoginSuccessNo2FA(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"plain-token"}`))
	}))
	defer srv.Close()

	home := t.TempDir()
	t.Setenv("HOME", home)

	if err := cmdLogin(srv.URL, "user", "secret"); err != nil {
		t.Fatalf("cmdLogin: %v", err)
	}

	cfg, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Token != "plain-token" {
		t.Fatalf("unexpected token %q", cfg.Token)
	}
}

func TestDoRequestReturnsStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte(`{"message":"nope"}`))
	}))
	defer srv.Close()

	raw, status, err := doRequest(http.MethodGet, srv.URL, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if status != http.StatusTeapot {
		t.Fatalf("status %d", status)
	}
	if string(raw) != `{"message":"nope"}` {
		t.Fatalf("body %q", string(raw))
	}
}
