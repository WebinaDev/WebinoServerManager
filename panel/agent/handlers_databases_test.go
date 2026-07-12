package main

import "testing"

func TestMysqlEscapeUser(t *testing.T) {
	got := mysqlEscapeUser("user'name")
	if got != "user''name" {
		t.Fatalf("expected escaped quote, got %q", got)
	}
}

func TestBuildGrantSQL(t *testing.T) {
	sql := buildGrantSQL("mydb", "u1", "localhost")
	if sql == "" {
		t.Fatal("expected non-empty SQL")
	}
	if !containsStr(sql, "GRANT ALL") || !containsStr(sql, "mydb") {
		t.Fatalf("unexpected sql: %s", sql)
	}
}

func TestMysqlEscapeIdent(t *testing.T) {
	got := mysqlEscapeIdent("db`name")
	if got != "db``name" {
		t.Fatalf("expected escaped backtick, got %q", got)
	}
}

func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexStr(s, sub) >= 0)
}

func indexStr(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
