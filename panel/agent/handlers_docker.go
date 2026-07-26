package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var dockerVolBase string

func initDockerEnv() {
	dockerVolBase = envOr("WEBINO_DOCKER_VOL_BASE", "/var/www")
}

var containerNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func handleDockerContainers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := dockerContainerList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"containers": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		handleDockerContainerAction(w, body)
	default:
		writeMethod(w)
	}
}

func handleDockerContainerAction(w http.ResponseWriter, body map[string]any) {
	action := strVal(body["action"])
	if action == "" {
		action = "list"
	}
	switch action {
	case "list":
		list, err := dockerContainerList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"containers": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "run", "create":
		handleDockerRun(w, body)
	case "start", "stop", "restart", "remove":
		name := strVal(body["name"])
		if name == "" {
			name = strVal(body["container"])
		}
		if !validContainerName(name) {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid container name"})
			return
		}
		out, err := runArgv([]string{"docker", action, name}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "name": name, "action": action})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "logs":
		name := strVal(body["name"])
		if name == "" {
			name = strVal(body["container"])
		}
		if !validContainerName(name) {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid container name"})
			return
		}
		tail := intVal(body["tail"], 100)
		if tail < 1 {
			tail = 100
		}
		if tail > 5000 {
			tail = 5000
		}
		out, err := runArgv([]string{"docker", "logs", "--tail", fmt.Sprintf("%d", tail), name}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"logs": out, "name": name})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "inspect":
		name := strVal(body["name"])
		if name == "" {
			name = strVal(body["container"])
		}
		if !validContainerName(name) {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid container name"})
			return
		}
		out, err := runArgv([]string{"docker", "inspect", name}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"inspect": out, "name": name})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func handleDockerRun(w http.ResponseWriter, body map[string]any) {
	name := strVal(body["name"])
	image := strVal(body["image"])
	if name == "" || image == "" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "name and image required"})
		return
	}
	if !validContainerName(name) {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid container name"})
		return
	}
	argv, err := buildDockerRunArgv(body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	out, err := runArgv(argv, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	containerID := strings.TrimSpace(out)
	data, _ := json.Marshal(map[string]string{
		"container_id": containerID,
		"name":         name,
		"image":        image,
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func buildDockerRunArgv(body map[string]any) ([]string, error) {
	name := strVal(body["name"])
	image := strVal(body["image"])
	argv := []string{"docker", "run", "-d", "--name", name}

	restart := strVal(body["restart_policy"])
	if restart == "" {
		restart = "unless-stopped"
	}
	if err := validateDockerRestartPolicy(restart); err != nil {
		return nil, err
	}
	if restart != "no" {
		argv = append(argv, "--restart", restart)
	}

	for _, p := range toStringSlice(body["ports"]) {
		if p != "" {
			if err := validateDockerPortMapping(p); err != nil {
				return nil, err
			}
			argv = append(argv, "-p", p)
		}
	}

	envMap := toStringMap(body["env"])
	for k, v := range envMap {
		argv = append(argv, "-e", k+"="+v)
	}

	for _, vol := range toStringSlice(body["volumes"]) {
		if vol == "" {
			continue
		}
		if err := validateDockerVolume(vol); err != nil {
			return nil, err
		}
		argv = append(argv, "-v", vol)
	}

	argv = append(argv, image)
	if cmd := strVal(body["command"]); cmd != "" {
		if err := validateDockerCommand(cmd); err != nil {
			return nil, err
		}
		argv = append(argv, strings.Fields(cmd)...)
	}

	return argv, nil
}

func validateDockerVolume(vol string) error {
	parts := strings.SplitN(vol, ":", 2)
	if len(parts) < 2 {
		return fmt.Errorf("invalid volume: %s", vol)
	}
	hostPath := parts[0]
	if hostPath == "" {
		return nil
	}
	abs, err := filepath.Abs(hostPath)
	if err != nil {
		return err
	}
	base, _ := filepath.Abs(dockerVolBase)
	if abs != base && !strings.HasPrefix(abs, base+string(os.PathSeparator)) {
		return fmt.Errorf("volume path outside allowed base")
	}
	return nil
}

func dockerContainerList() ([]map[string]string, error) {
	out, err := runArgv([]string{"docker", "ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"}, "")
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
		row := map[string]string{
			"id":     safeIdx(parts, 0),
			"name":   safeIdx(parts, 1),
			"image":  safeIdx(parts, 2),
			"status": safeIdx(parts, 3),
			"ports":  safeIdx(parts, 4),
		}
		list = append(list, row)
	}
	return list, nil
}

func safeIdx(parts []string, i int) string {
	if i < len(parts) {
		return parts[i]
	}
	return ""
}

func validContainerName(name string) bool {
	return name != "" && containerNameRe.MatchString(name)
}

func handleDockerImages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := dockerImageList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"images": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		handleDockerImageAction(w, body)
	default:
		writeMethod(w)
	}
}

func handleDockerImageAction(w http.ResponseWriter, body map[string]any) {
	action := strVal(body["action"])
	switch action {
	case "list":
		list, err := dockerImageList()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"images": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "pull":
		image := strVal(body["image"])
		if image == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "image required"})
			return
		}
		out, err := runArgv([]string{"docker", "pull", image}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "image": image})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "remove":
		image := strVal(body["image"])
		if image == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "image required"})
			return
		}
		out, err := runArgv([]string{"docker", "rmi", image}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "image": image})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func dockerImageList() ([]map[string]string, error) {
	out, err := runArgv([]string{"docker", "images", "--format", "{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}"}, "")
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
			"repository": safeIdx(parts, 0),
			"id":         safeIdx(parts, 1),
			"size":       safeIdx(parts, 2),
		})
	}
	return list, nil
}

func toStringSlice(v any) []string {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case []string:
		return t
	case []any:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func toStringMap(v any) map[string]string {
	out := map[string]string{}
	if v == nil {
		return out
	}
	if m, ok := v.(map[string]any); ok {
		for k, val := range m {
			out[k] = fmt.Sprint(val)
		}
		return out
	}
	if m, ok := v.(map[string]string); ok {
		return m
	}
	return out
}

func intVal(v any, def int) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case int64:
		return int(t)
	case json.Number:
		n, _ := t.Int64()
		return int(n)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err != nil {
			return def
		}
		return n
	default:
		return def
	}
}
