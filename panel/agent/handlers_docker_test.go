package main

import "testing"

func TestValidContainerName(t *testing.T) {
	if !validContainerName("my-app_1") {
		t.Fatal("expected valid name")
	}
	if validContainerName("") || validContainerName("bad name") {
		t.Fatal("expected invalid name")
	}
}

func TestBuildDockerRunArgv(t *testing.T) {
	dockerVolBase = t.TempDir()
	argv, err := buildDockerRunArgv(map[string]any{
		"name":  "webapp",
		"image": "nginx:alpine",
		"ports": []any{"8080:80"},
		"env":   map[string]any{"FOO": "bar"},
		"volumes": []any{
			dockerVolBase + ":/data",
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	joined := joinArgv(argv)
	for _, want := range []string{"docker", "run", "-d", "--name", "webapp", "-p", "8080:80", "-e", "FOO=bar", "nginx:alpine"} {
		if !containsStr(joined, want) {
			t.Fatalf("missing %q in %s", want, joined)
		}
	}
}

func TestBuildDockerRunArgvRejectsBadVolume(t *testing.T) {
	dockerVolBase = "/var/www"
	_, err := buildDockerRunArgv(map[string]any{
		"name":    "bad",
		"image":   "alpine",
		"volumes": []any{"/etc/passwd:/mnt"},
	})
	if err == nil {
		t.Fatal("expected volume jail error")
	}
}

func joinArgv(argv []string) string {
	return stringsJoin(argv, " ")
}

func stringsJoin(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}
