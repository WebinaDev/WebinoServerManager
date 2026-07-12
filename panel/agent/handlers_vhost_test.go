package main

import (
	"strings"
	"testing"
)

func TestBuildNginxVhost(t *testing.T) {
	conf := buildNginxVhost(nginxVhostOpts{
		Fqdn:       "sub.example.com",
		Root:       "/var/www/sites/sub.example.com/public",
		PhpPool:    "sub_example",
		PhpVersion: "8.2",
		Ssl:        true,
		ForceHTTPS: true,
		Hsts:       true,
	})
	if !strings.Contains(conf, "fastcgi_pass") {
		t.Fatal("expected php fastcgi block")
	}
	if !strings.Contains(conf, "listen 443") {
		t.Fatal("expected ssl listen")
	}
	if !strings.Contains(conf, "Strict-Transport-Security") {
		t.Fatal("expected hsts header")
	}
}

func TestBuildNginxVhostHotlink(t *testing.T) {
	conf := buildNginxVhost(nginxVhostOpts{
		Fqdn:           "img.example.com",
		Root:           "/var/www/img",
		HotlinkProtect: true,
	})
	if !strings.Contains(conf, "valid_referers") {
		t.Fatal("expected hotlink protection block")
	}
}
