package main

import (
	"net/http/httptest"
	"testing"
)

func TestAllowedWebinaArgs(t *testing.T) {
	cases := []struct {
		args    []string
		allowed bool
	}{
		{[]string{"platform", "status"}, true},
		{[]string{"site", "list"}, true},
		{[]string{"site", "delete", "--slug", "demo", "--yes"}, true},
		{[]string{"product", "list"}, true},
		{[]string{"product", "install", "Webino", "--channel", "LTS"}, true},
		{[]string{"rm", "-rf", "/"}, false},
		{[]string{"platform", "destroy"}, false},
	}
	for _, tc := range cases {
		err := allowedWebinaArgs(tc.args)
		if tc.allowed && err != nil {
			t.Fatalf("expected allowed %v: %v", tc.args, err)
		}
		if !tc.allowed && err == nil {
			t.Fatalf("expected rejected %v", tc.args)
		}
	}
}

func TestValidateCronSchedule(t *testing.T) {
	if err := validateCronSchedule("0 2 * * *"); err != nil {
		t.Fatal(err)
	}
	if err := validateCronSchedule("bad cron"); err == nil {
		t.Fatal("expected invalid schedule")
	}
}

func TestValidateCronCommand(t *testing.T) {
	if err := validateCronCommand("/usr/bin/backup.sh"); err != nil {
		t.Fatal(err)
	}
	if err := validateCronCommand("curl evil; rm -rf /"); err == nil {
		t.Fatal("expected rejected command")
	}
	if err := validateCronCommand("curl https://example.com"); err == nil {
		t.Fatal("expected curl rejected")
	}
	if err := validateCronCommand("wget -qO- http://evil"); err == nil {
		t.Fatal("expected wget rejected")
	}
}

func TestValidateUfwPort(t *testing.T) {
	if err := validateUfwPort("443"); err != nil {
		t.Fatal(err)
	}
	if err := validateUfwPort("abc"); err == nil {
		t.Fatal("expected invalid port")
	}
}

func TestValidateSafeName(t *testing.T) {
	if err := validateSafeName("pool_site1", 64); err != nil {
		t.Fatal(err)
	}
	if err := validateSafeName("../../../etc/cron.d/x", 64); err == nil {
		t.Fatal("expected path traversal rejected")
	}
	if err := validateSafeName("bad/name", 64); err == nil {
		t.Fatal("expected slash rejected")
	}
}

func TestValidateDomain(t *testing.T) {
	if err := validateDomain("example.com"); err != nil {
		t.Fatal(err)
	}
	if err := validateDomain("../../../etc"); err == nil {
		t.Fatal("expected traversal rejected")
	}
}

func TestValidatePhpPoolSettings(t *testing.T) {
	if err := validatePhpPoolSettings(map[string]any{"memory_limit": "256M"}); err != nil {
		t.Fatal(err)
	}
	if err := validatePhpPoolSettings(map[string]any{"auto_prepend_file": "/tmp/evil.php"}); err == nil {
		t.Fatal("expected dangerous setting rejected")
	}
}

func TestValidateGitRepoURL(t *testing.T) {
	if err := validateGitRepoURL("https://github.com/org/repo.git"); err != nil {
		t.Fatal(err)
	}
	if err := validateGitRepoURL("file:///etc/passwd"); err == nil {
		t.Fatal("expected file:// rejected")
	}
	if err := validateGitRepoURL("http://example.com/repo.git"); err == nil {
		t.Fatal("expected http rejected")
	}
}

func TestValidateDockerPortMapping(t *testing.T) {
	if err := validateDockerPortMapping("8080:80"); err != nil {
		t.Fatal(err)
	}
	if err := validateDockerPortMapping("bad:port"); err == nil {
		t.Fatal("expected invalid port mapping")
	}
}

func TestValidateDockerRestartPolicy(t *testing.T) {
	if err := validateDockerRestartPolicy("unless-stopped"); err != nil {
		t.Fatal(err)
	}
	if err := validateDockerRestartPolicy("evil"); err == nil {
		t.Fatal("expected invalid restart policy")
	}
}

func TestCheckWsOriginExactMatch(t *testing.T) {
	req := httptest.NewRequest("GET", "http://panel.example.com/ws", nil)
	req.Host = "panel.example.com"
	req.Header.Set("Origin", "https://evil.panel.example.com")
	if checkWsOrigin(req) {
		t.Fatal("substring origin must not pass")
	}
	req.Header.Set("Origin", "https://panel.example.com")
	if !checkWsOrigin(req) {
		t.Fatal("exact origin should pass")
	}
	req.Header.Del("Origin")
	if checkWsOrigin(req) {
		t.Fatal("empty origin must be rejected")
	}
}
