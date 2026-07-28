package main

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// softstoreUseHostNS runs Softstore apt/systemctl against the real host when the
// agent container is privileged with pid:host (aaPanel-style hosting stack).
// Set WEBINO_SOFTSTORE_ON_HOST=0 to force installs inside the agent container.
func softstoreUseHostNS() bool {
	v := strings.TrimSpace(os.Getenv("WEBINO_SOFTSTORE_ON_HOST"))
	if v == "0" || strings.EqualFold(v, "false") || strings.EqualFold(v, "no") {
		return false
	}
	if _, err := exec.LookPath("nsenter"); err != nil {
		return false
	}
	if _, err := os.Stat("/proc/1/root/etc/os-release"); err != nil {
		return false
	}
	return true
}

func softstoreHostArgv(argv []string) []string {
	if len(argv) == 0 || !softstoreUseHostNS() {
		return argv
	}
	if argv[0] == "nsenter" {
		return argv
	}
	out := make([]string, 0, len(argv)+9)
	out = append(out, "nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--")
	out = append(out, argv...)
	return out
}

func softstoreBash(script string) (string, error) {
	return runArgvEnv(softstoreHostArgv([]string{"bash", "-lc", script}), map[string]string{
		"DEBIAN_FRONTEND": "noninteractive",
	})
}

func softstoreHostLookPath(bin string) (string, error) {
	bin = strings.TrimSpace(bin)
	if bin == "" {
		return "", exec.ErrNotFound
	}
	if !softstoreUseHostNS() {
		return exec.LookPath(bin)
	}
	out, err := softstoreBash("command -v " + strconv.Quote(bin))
	out = strings.TrimSpace(out)
	if err != nil || out == "" {
		return "", exec.ErrNotFound
	}
	return out, nil
}
