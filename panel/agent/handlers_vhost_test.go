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

func TestBuildNginxVhostRewriteWordpress(t *testing.T) {
	conf := buildNginxVhost(nginxVhostOpts{
		Fqdn:            "wp.example.com",
		Root:            "/var/www/wp",
		RewriteTemplate: "wordpress",
		Aliases:         []string{"www.wp.example.com"},
		DenyPaths:       []string{"/.env"},
		TrafficLimitMB:  10,
		AccessLog:       "/var/log/nginx/wp.example.com.access.log",
		ErrorLog:        "/var/log/nginx/wp.example.com.error.log",
	})
	if !strings.Contains(conf, "server_name wp.example.com www.wp.example.com") {
		t.Fatal("expected aliases in server_name")
	}
	if !strings.Contains(conf, "/index.php?$args") {
		t.Fatal("expected wordpress rewrite")
	}
	if !strings.Contains(conf, "location = /.env") {
		t.Fatal("expected deny path")
	}
	if !strings.Contains(conf, "limit_rate") {
		t.Fatal("expected traffic limit")
	}
	if !strings.Contains(conf, "access_log /var/log/nginx/wp.example.com.access.log") {
		t.Fatal("expected access_log")
	}
}

func TestBuildNginxVhostHTTP3(t *testing.T) {
	conf := buildNginxVhost(nginxVhostOpts{
		Fqdn:  "h3.example.com",
		Root:  "/var/www/h3",
		Ssl:   true,
		Http3: true,
	})
	if !strings.Contains(conf, "listen 443 quic") {
		t.Fatal("expected quic listen")
	}
	if !strings.Contains(conf, "Alt-Svc") {
		t.Fatal("expected Alt-Svc header")
	}
}

func TestBuildApacheVhost(t *testing.T) {
	conf := buildApacheVhost(nginxVhostOpts{
		Fqdn:            "ap.example.com",
		Root:            "/var/www/ap",
		PhpPool:         "ap_pool",
		PhpVersion:      "8.3",
		Ssl:             true,
		RewriteTemplate: "wordpress",
		Aliases:         []string{"www.ap.example.com"},
	})
	if !strings.Contains(conf, "<VirtualHost *:80>") {
		t.Fatal("expected apache vhost")
	}
	if !strings.Contains(conf, "ServerAlias www.ap.example.com") {
		t.Fatal("expected alias")
	}
	if !strings.Contains(conf, "proxy:unix:") {
		t.Fatal("expected php-fpm proxy")
	}
	if !strings.Contains(conf, "<VirtualHost *:443>") {
		t.Fatal("expected ssl vhost")
	}
}
