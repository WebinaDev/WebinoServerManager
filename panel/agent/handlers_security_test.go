package main

import (
	"strings"
	"testing"
)

func TestParseUfwStatus(t *testing.T) {
	out := `Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] 80/tcp                     ALLOW IN    Anywhere`
	rules := parseUfwStatus(out)
	if len(rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(rules))
	}
	if rules[0]["num"] != "1" {
		t.Fatalf("expected rule num 1, got %s", rules[0]["num"])
	}
}

func TestParseFail2banStatus(t *testing.T) {
	out := `Status
|- Number of jail:	2
|- Jail list:	sshd, nginx-http-auth`
	jails := parseFail2banStatus(out)
	if len(jails) != 2 {
		t.Fatalf("expected 2 jails, got %d", len(jails))
	}
}

func TestParseClamscanInfected(t *testing.T) {
	out := `/var/www/test.php: Eicar-Test-Signature FOUND
/var/www/clean.txt: OK`
	infected := parseClamscanInfected(out)
	if len(infected) != 1 {
		t.Fatalf("expected 1 infected, got %d", len(infected))
	}
	if !strings.Contains(infected[0], "test.php") {
		t.Fatalf("unexpected path: %s", infected[0])
	}
}

func TestAuthorizedKeyAddRemove(t *testing.T) {
	tmp := t.TempDir() + "/authorized_keys"
	sshAuthKeysPath = tmp
	line := "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB test@host"
	if err := addAuthorizedKey(line); err != nil {
		t.Fatal(err)
	}
	keys, err := readAuthorizedKeys()
	if err != nil || len(keys) != 1 {
		t.Fatalf("expected 1 key, got %v err=%v", keys, err)
	}
	if err := removeAuthorizedKey("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB"); err != nil {
		t.Fatal(err)
	}
	keys, _ = readAuthorizedKeys()
	if len(keys) != 0 {
		t.Fatalf("expected 0 keys after remove, got %d", len(keys))
	}
}
