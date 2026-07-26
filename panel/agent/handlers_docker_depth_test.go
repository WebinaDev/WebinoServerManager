package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestJailComposeProjectDir(t *testing.T) {
	dockerComposeRoot = t.TempDir()
	dir, err := jailComposeProjectDir("myproj")
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dockerComposeRoot, "myproj")
	if dir != want {
		t.Fatalf("got %s want %s", dir, want)
	}
	_, err = jailComposeProjectDir("../escape")
	if err == nil && validContainerName("../escape") {
		t.Fatal("expected invalid project")
	}
}

func TestWriteDockerDaemonAllowlisted(t *testing.T) {
	dir := t.TempDir()
	dockerDaemonJSON = filepath.Join(dir, "daemon.json")
	err := writeDockerDaemonAllowlisted(map[string]any{
		"registry-mirrors": []any{"https://mirror.example"},
		"log-opts":         map[string]any{"max-size": "10m", "max-file": "3"},
	})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := readDockerDaemonAllowlisted()
	if err != nil {
		t.Fatal(err)
	}
	mirrors, _ := cfg["registry-mirrors"].([]string)
	if len(mirrors) != 1 || mirrors[0] != "https://mirror.example" {
		t.Fatalf("mirrors: %#v", cfg["registry-mirrors"])
	}
	if _, err := os.Stat(dockerDaemonJSON + ".bak"); err == nil {
		t.Fatal("bak should not exist on first write without prior file")
	}
	// second write creates bak
	_ = writeDockerDaemonAllowlisted(map[string]any{
		"registry-mirrors": []any{"https://mirror2.example"},
	})
	if _, err := os.Stat(dockerDaemonJSON + ".bak"); err != nil {
		t.Fatal("expected bak after second write")
	}
}

func TestSoftstoreComposeTemplates(t *testing.T) {
	if softstoreComposeTemplates["compose_up_redis"] == "" {
		t.Fatal("missing redis template")
	}
	if !softstoreScriptIDs["compose_up_redis"] {
		t.Fatal("compose_up_redis not allowlisted")
	}
}
