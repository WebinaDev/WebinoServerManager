package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSoftstoreNormalizeOptions(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"object", `{}`},
		{"array", `[]`},
		{"null", `null`},
		{"omitted", ``},
		{"with_keys", `{"document_root":"/var/www"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var raw json.RawMessage
			if tc.raw != "" {
				raw = json.RawMessage(tc.raw)
			}
			got := softstoreNormalizeOptions(raw)
			if got == nil {
				t.Fatal("expected non-nil map")
			}
			if tc.name == "with_keys" && got["document_root"] != "/var/www" {
				t.Fatalf("got %#v", got)
			}
		})
	}
}

func TestSoftstoreInstallAcceptsEmptyOptionsArray(t *testing.T) {
	// install_nginx is allowlisted; on CI without apt we still get past JSON decode.
	req := httptest.NewRequest(http.MethodPost, "/v1/softstore/install", strings.NewReader(
		`{"script_id":"install_nginx","options":[]}`,
	))
	rr := httptest.NewRecorder()
	handleSoftstoreInstall(rr, req)
	if rr.Code == http.StatusBadRequest {
		var env envelope
		_ = json.Unmarshal(rr.Body.Bytes(), &env)
		if env.Error == "invalid body" {
			t.Fatalf("options:[] must not yield invalid body: %s", rr.Body.String())
		}
	}
}

func TestSoftstoreInstallAcceptsEmptyOptionsObject(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/softstore/install", strings.NewReader(
		`{"script_id":"install_nginx","options":{}}`,
	))
	rr := httptest.NewRecorder()
	handleSoftstoreInstall(rr, req)
	if rr.Code == http.StatusBadRequest {
		var env envelope
		_ = json.Unmarshal(rr.Body.Bytes(), &env)
		if env.Error == "invalid body" {
			t.Fatalf("options:{} must not yield invalid body: %s", rr.Body.String())
		}
	}
}
