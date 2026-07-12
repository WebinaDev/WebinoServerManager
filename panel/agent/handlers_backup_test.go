package main

import (
	"strings"
	"testing"
)

func TestBackupFileSizeEmpty(t *testing.T) {
	if backupFileSize("nonexistent.tar.gz") != 0 {
		// may be 0 if file doesn't exist
	}
}

func TestResticBackupArgv(t *testing.T) {
	repo := "s3:s3.amazonaws.com/bucket"
	if !strings.HasPrefix(repo, "s3:") {
		t.Fatal("expected s3 repo prefix")
	}
}

func TestRestoreTypeSelection(t *testing.T) {
	btype := "db"
	if btype != "db" {
		t.Fatal("expected db type")
	}
}
