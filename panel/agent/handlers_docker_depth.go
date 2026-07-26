package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var (
	dockerComposeRoot string
	dockerDaemonJSON  string
)

func initDockerDepthEnv() {
	dockerComposeRoot = envOr("WEBINO_DOCKER_COMPOSE_ROOT", "/var/lib/webino/compose")
	dockerDaemonJSON = envOr("WEBINO_DOCKER_DAEMON_JSON", "/etc/docker/daemon.json")
}

func handleDockerCompose(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		project := r.URL.Query().Get("project")
		action := r.URL.Query().Get("action")
		if action == "" {
			action = "ps"
		}
		handleDockerComposeAction(w, map[string]any{
			"action":  action,
			"project": project,
			"tail":    r.URL.Query().Get("tail"),
		})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		handleDockerComposeAction(w, body)
	default:
		writeMethod(w)
	}
}

func handleDockerComposeAction(w http.ResponseWriter, body map[string]any) {
	action := strVal(body["action"])
	project := strVal(body["project"])
	if project == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "project required"})
		return
	}
	if !validContainerName(project) {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid project name"})
		return
	}
	dir, err := jailComposeProjectDir(project)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}

	switch action {
	case "up", "write_up":
		yamlContent := strVal(body["compose_yaml"])
		envFile := strVal(body["env_file"])
		if yamlContent == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "compose_yaml required"})
			return
		}
		if err := os.MkdirAll(dir, 0o750); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		composePath := filepath.Join(dir, "docker-compose.yml")
		if err := os.WriteFile(composePath, []byte(yamlContent), 0o640); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		if envFile != "" {
			if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(envFile), 0o640); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
		}
		out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "up", "-d"}, dir)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]string{"project": project, "dir": dir, "log": out, "action": "up"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "down":
		composePath := filepath.Join(dir, "docker-compose.yml")
		out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "down"}, dir)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]string{"project": project, "log": out, "action": "down"})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "ps":
		composePath := filepath.Join(dir, "docker-compose.yml")
		out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "ps", "--format", "json"}, dir)
		if err != nil {
			// fallback plain
			out2, err2 := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "ps"}, dir)
			if err2 != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
				return
			}
			data, _ := json.Marshal(map[string]string{"project": project, "ps": out2})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
			return
		}
		data, _ := json.Marshal(map[string]string{"project": project, "ps": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "logs":
		composePath := filepath.Join(dir, "docker-compose.yml")
		tail := intVal(body["tail"], 100)
		if tail < 1 {
			tail = 100
		}
		if tail > 5000 {
			tail = 5000
		}
		out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "logs", "--tail", fmt.Sprintf("%d", tail)}, dir)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]string{"project": project, "logs": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func jailComposeProjectDir(project string) (string, error) {
	base, err := filepath.Abs(dockerComposeRoot)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, project)
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	if abs != base && !strings.HasPrefix(abs, base+string(os.PathSeparator)) {
		return "", fmt.Errorf("project path outside compose root")
	}
	return abs, nil
}

func handleDockerNetworks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := dockerNetworkList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"networks": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		name := strVal(body["name"])
		if !validContainerName(name) {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid network name"})
			return
		}
		switch action {
		case "create":
			out, err := runArgv([]string{"docker", "network", "create", name}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
				return
			}
			data, _ := json.Marshal(map[string]string{"name": name, "id": strings.TrimSpace(out)})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		case "remove", "rm":
			out, err := runArgv([]string{"docker", "network", "rm", name}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
				return
			}
			data, _ := json.Marshal(map[string]string{"name": name, "output": out})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		}
	default:
		writeMethod(w)
	}
}

func dockerNetworkList() ([]map[string]string, error) {
	out, err := runArgv([]string{"docker", "network", "ls", "--format", "{{.ID}}\t{{.Name}}\t{{.Driver}}\t{{.Scope}}"}, "")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	list := make([]map[string]string, 0)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		list = append(list, map[string]string{
			"id":     safeIdx(parts, 0),
			"name":   safeIdx(parts, 1),
			"driver": safeIdx(parts, 2),
			"scope":  safeIdx(parts, 3),
		})
	}
	return list, nil
}

func handleDockerVolumes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := dockerVolumeList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"volumes": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		name := strVal(body["name"])
		if !validContainerName(name) {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid volume name"})
			return
		}
		switch action {
		case "create":
			out, err := runArgv([]string{"docker", "volume", "create", name}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
				return
			}
			data, _ := json.Marshal(map[string]string{"name": strings.TrimSpace(out)})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		case "remove", "rm":
			out, err := runArgv([]string{"docker", "volume", "rm", name}, "")
			if err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
				return
			}
			data, _ := json.Marshal(map[string]string{"name": name, "output": out})
			writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
		}
	default:
		writeMethod(w)
	}
}

func dockerVolumeList() ([]map[string]string, error) {
	out, err := runArgv([]string{"docker", "volume", "ls", "--format", "{{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"}, "")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	list := make([]map[string]string, 0)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		list = append(list, map[string]string{
			"name":       safeIdx(parts, 0),
			"driver":     safeIdx(parts, 1),
			"mountpoint": safeIdx(parts, 2),
		})
	}
	return list, nil
}

func handleDockerRegistry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	action := strVal(body["action"])
	server := strVal(body["server"])
	if server == "" {
		server = "https://index.docker.io/v1/"
	}
	switch action {
	case "login":
		user := strVal(body["username"])
		pass := strVal(body["password"])
		if user == "" || pass == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "username and password required"})
			return
		}
		// docker login --password-stdin
		out, err := runArgvEnvWithStdin(
			[]string{"docker", "login", server, "-u", user, "--password-stdin"},
			pass+"\n",
		)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]string{"server": server, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "logout":
		out, err := runArgv([]string{"docker", "logout", server}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]string{"server": server, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func handleDockerDaemon(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := readDockerDaemonAllowlisted()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(cfg)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPut, http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		if err := writeDockerDaemonAllowlisted(body); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		out, err := runArgv([]string{"systemctl", "reload", "docker"}, "")
		if err != nil {
			// try restart as fallback message only
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: "daemon written but reload failed: " + err.Error() + ": " + out})
			return
		}
		cfg, _ := readDockerDaemonAllowlisted()
		data, _ := json.Marshal(map[string]any{"daemon": cfg, "reload": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func readDockerDaemonAllowlisted() (map[string]any, error) {
	raw, err := os.ReadFile(dockerDaemonJSON)
	out := map[string]any{
		"registry-mirrors": []string{},
		"log-opts":         map[string]string{},
	}
	if err != nil {
		if os.IsNotExist(err) {
			return out, nil
		}
		return nil, err
	}
	var full map[string]any
	if err := json.Unmarshal(raw, &full); err != nil {
		return nil, err
	}
	if m, ok := full["registry-mirrors"].([]any); ok {
		mirrors := make([]string, 0, len(m))
		for _, v := range m {
			if s, ok := v.(string); ok {
				mirrors = append(mirrors, s)
			}
		}
		out["registry-mirrors"] = mirrors
	}
	if lo, ok := full["log-opts"].(map[string]any); ok {
		opts := map[string]string{}
		if v, ok := lo["max-size"].(string); ok {
			opts["max-size"] = v
		}
		if v, ok := lo["max-file"].(string); ok {
			opts["max-file"] = v
		}
		out["log-opts"] = opts
	}
	return out, nil
}

func writeDockerDaemonAllowlisted(body map[string]any) error {
	full := map[string]any{}
	if raw, err := os.ReadFile(dockerDaemonJSON); err == nil {
		_ = json.Unmarshal(raw, &full)
		_ = os.WriteFile(dockerDaemonJSON+".bak", raw, 0o640)
	}
	if mirrors, ok := body["registry-mirrors"]; ok {
		full["registry-mirrors"] = toStringSlice(mirrors)
	}
	if logOptsRaw, ok := body["log-opts"]; ok {
		opts := map[string]string{}
		src := toStringMap(logOptsRaw)
		if v, ok := src["max-size"]; ok && v != "" {
			opts["max-size"] = v
		}
		if v, ok := src["max-file"]; ok && v != "" {
			opts["max-file"] = v
		}
		full["log-opts"] = opts
	}
	b, err := json.MarshalIndent(full, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dockerDaemonJSON), 0o755); err != nil {
		return err
	}
	return os.WriteFile(dockerDaemonJSON, b, 0o640)
}

// Softstore fixed compose templates
var softstoreComposeTemplates = map[string]string{
	"compose_up_redis": `services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
`,
	"compose_up_nginx": `services:
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "8088:80"
`,
}

func runSoftstoreComposeUp(scriptID, project string) (string, error) {
	yamlContent, ok := softstoreComposeTemplates[scriptID]
	if !ok {
		return "", errSoftstore("unknown compose template")
	}
	if !validContainerName(project) {
		return "", errSoftstore("invalid project name")
	}
	dir, err := jailComposeProjectDir(project)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	composePath := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(composePath, []byte(yamlContent), 0o640); err != nil {
		return "", err
	}
	out, err := runArgv([]string{"docker", "compose", "-f", composePath, "-p", project, "up", "-d"}, dir)
	if err != nil {
		return out, err
	}
	return "project=" + project + " dir=" + dir + "\n" + out, nil
}
