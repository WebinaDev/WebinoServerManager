package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
)

var runtimesScriptIDs = map[string]bool{
	"install_node_nvm":        true,
	"install_node_nodesource": true,
	"install_python_distro":   true,
	"install_go_distro":       true,
	"install_java_distro":     true,
}

var runtimeProjectNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`)

func runtimesStateDir() string {
	return filepath.Join(filesRoot, ".webino", "runtimes")
}

func runtimesPidPath(name string) string {
	return filepath.Join(runtimesStateDir(), name+".pid")
}

func runtimesLogPath(name string) string {
	return filepath.Join(runtimesStateDir(), name+".log")
}

func handleRuntimesStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	data, _ := json.Marshal(map[string]any{
		"runtimes": map[string]any{
			"node":   probeRuntime("node", "node"),
			"python": probeRuntime("python3", "python3"),
			"go":     probeRuntime("go", "go"),
			"java":   probeRuntime("java", "java"),
		},
	})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func probeRuntime(bin, label string) map[string]any {
	path, err := exec.LookPath(bin)
	if err != nil {
		return map[string]any{"status": "missing", "detail": label + " not in PATH"}
	}
	versionOut, verErr := runArgv([]string{bin, "--version"}, "")
	if verErr != nil {
		return map[string]any{"status": "installed", "path": path, "version": ""}
	}
	return map[string]any{"status": "installed", "path": path, "version": strings.TrimSpace(versionOut)}
}

func handleRuntimesInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	var body struct {
		ScriptID string          `json:"script_id"`
		Options  json.RawMessage `json:"options"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if !runtimesScriptIDs[body.ScriptID] {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "script_id not allowlisted"})
		return
	}
	_ = softstoreNormalizeOptions(body.Options)
	logOut, err := runRuntimesInstallScript(body.ScriptID)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + logOut})
		return
	}
	data, _ := json.Marshal(map[string]string{"script_id": body.ScriptID, "log": logOut})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func runRuntimesInstallScript(scriptID string) (string, error) {
	switch scriptID {
	case "install_node_nvm":
		if path, err := exec.LookPath("node"); err == nil {
			return "node already present: " + path, nil
		}
		home := os.Getenv("HOME")
		if home == "" {
			home = "/root"
		}
		nvmDir := filepath.Join(home, ".nvm")
		if _, err := os.Stat(filepath.Join(nvmDir, "nvm.sh")); err != nil {
			out, installErr := runArgv([]string{
				"bash", "-c",
				"curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",
			}, "")
			if installErr != nil {
				return out, installErr
			}
		}
		return runArgv([]string{
			"bash", "-c",
			`export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm install --lts && nvm alias default 'lts/*'`,
		}, "")
	case "install_node_nodesource":
		if path, err := exec.LookPath("node"); err == nil {
			return "node already present: " + path, nil
		}
		_ = softstoreEnsureUbuntuUniverse()
		setupOut, setupErr := runArgvEnv([]string{
			"bash", "-c",
			"curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
		}, map[string]string{"DEBIAN_FRONTEND": "noninteractive"})
		if setupErr != nil {
			// Fallback: distro nodejs when NodeSource is blocked.
			out, err := softstoreAptInstallFirstAvailable(
				[]string{"nodejs"},
				[]string{"nodejs", "npm"},
			)
			return setupOut + "\n" + out, err
		}
		out, err := softstoreAptInstall("nodejs")
		return setupOut + "\n" + out, err
	case "install_python_distro":
		if path, err := exec.LookPath("python3"); err == nil {
			return "python3 already present: " + path, nil
		}
		return softstoreAptInstall("python3", "python3-venv", "python3-pip")
	case "install_go_distro":
		if path, err := exec.LookPath("go"); err == nil {
			return "go already present: " + path, nil
		}
		return softstoreAptInstallFirstAvailable(
			[]string{"golang-go"},
			[]string{"golang"},
		)
	case "install_java_distro":
		if path, err := exec.LookPath("java"); err == nil {
			return "java already present: " + path, nil
		}
		return softstoreAptInstallFirstAvailable(
			[]string{"openjdk-17-jdk"},
			[]string{"openjdk-21-jdk"},
			[]string{"default-jdk"},
		)
	default:
		return "", fmt.Errorf("unknown script")
	}
}

func handleRuntimesProjects(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action      string `json:"action"`
		Name        string `json:"name"`
		Runtime     string `json:"runtime"`
		WorkDir     string `json:"work_dir"`
		EntryScript string `json:"entry_script"`
		NpmScript   string `json:"npm_script"`
		Tail        int    `json:"tail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	if !runtimeProjectNameRe.MatchString(body.Name) {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid project name"})
		return
	}
	switch body.Action {
	case "start":
		result, err := runtimeProjectStart(body.Name, body.Runtime, body.WorkDir, body.EntryScript, body.NpmScript)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "stop":
		result, err := runtimeProjectStop(body.Name)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "restart":
		_, _ = runtimeProjectStop(body.Name)
		result, err := runtimeProjectStart(body.Name, body.Runtime, body.WorkDir, body.EntryScript, body.NpmScript)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "logs":
		tail := body.Tail
		if tail <= 0 {
			tail = 100
		}
		if tail > 2000 {
			tail = 2000
		}
		result, err := runtimeProjectLogs(body.Name, tail)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "status":
		result := runtimeProjectStatus(body.Name)
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func runtimeBuildArgv(runtime, entryScript, npmScript string) ([]string, error) {
	runtime = strings.ToLower(strings.TrimSpace(runtime))
	switch runtime {
	case "node":
		if npmScript != "" {
			if !wpEntryNameRe.MatchString(npmScript) {
				return nil, fmt.Errorf("invalid npm script name")
			}
			return []string{"npm", "run", npmScript}, nil
		}
		if entryScript == "" {
			entryScript = "index.js"
		}
		if !wpEntryNameRe.MatchString(entryScript) {
			return nil, fmt.Errorf("invalid entry script")
		}
		return []string{"node", entryScript}, nil
	case "python":
		if entryScript == "" {
			entryScript = "app.py"
		}
		if !wpEntryNameRe.MatchString(entryScript) {
			return nil, fmt.Errorf("invalid entry script")
		}
		return []string{"python3", entryScript}, nil
	case "go":
		if entryScript == "" {
			entryScript = "main.go"
		}
		if !wpEntryNameRe.MatchString(entryScript) {
			return nil, fmt.Errorf("invalid entry script")
		}
		return []string{"go", "run", entryScript}, nil
	case "java":
		if entryScript == "" {
			entryScript = "Main.java"
		}
		if !wpEntryNameRe.MatchString(entryScript) {
			return nil, fmt.Errorf("invalid entry script")
		}
		if strings.HasSuffix(strings.ToLower(entryScript), ".jar") {
			return []string{"java", "-jar", entryScript}, nil
		}
		return []string{"java", entryScript}, nil
	default:
		return nil, fmt.Errorf("unsupported runtime")
	}
}

func runtimeProjectStart(name, runtime, workDir, entryScript, npmScript string) (map[string]any, error) {
	if pid, running := runtimeReadPid(name); running {
		return map[string]any{"name": name, "pid": pid, "status": "running"}, nil
	}
	absWork, err := safeFilePath(workDir)
	if err != nil {
		return nil, err
	}
	argv, err := runtimeBuildArgv(runtime, entryScript, npmScript)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(runtimesStateDir(), 0o755); err != nil {
		return nil, err
	}
	logPath := runtimesLogPath(name)
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	defer logFile.Close()

	unlock := acquireExecLock("runtimes:" + name)
	defer unlock()

	cmd := exec.Command(argv[0], argv[1:]...)
	cmd.Dir = absWork
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if startErr := cmd.Start(); startErr != nil {
		return nil, startErr
	}
	if writeErr := os.WriteFile(runtimesPidPath(name), []byte(strconv.Itoa(cmd.Process.Pid)), 0o644); writeErr != nil {
		_ = cmd.Process.Kill()
		return nil, writeErr
	}
	return map[string]any{"name": name, "pid": cmd.Process.Pid, "status": "running", "log_path": logPath}, nil
}

func runtimeProjectStop(name string) (map[string]any, error) {
	pid, running := runtimeReadPid(name)
	if !running {
		_ = os.Remove(runtimesPidPath(name))
		return map[string]any{"name": name, "status": "stopped"}, nil
	}
	proc, err := os.FindProcess(pid)
	if err == nil {
		_ = proc.Signal(syscall.SIGTERM)
	}
	_ = os.Remove(runtimesPidPath(name))
	return map[string]any{"name": name, "pid": pid, "status": "stopped"}, nil
}

func runtimeReadPid(name string) (int, bool) {
	raw, err := os.ReadFile(runtimesPidPath(name))
	if err != nil {
		return 0, false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil || pid <= 0 {
		return 0, false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return 0, false
	}
	if err := proc.Signal(syscall.Signal(0)); err != nil {
		return 0, false
	}
	return pid, true
}

func runtimeProjectStatus(name string) map[string]any {
	pid, running := runtimeReadPid(name)
	if running {
		return map[string]any{"name": name, "pid": pid, "status": "running"}
	}
	return map[string]any{"name": name, "status": "stopped"}
}

func runtimeProjectLogs(name string, tail int) (map[string]any, error) {
	logPath := runtimesLogPath(name)
	raw, err := os.ReadFile(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]any{"name": name, "logs": ""}, nil
		}
		return nil, err
	}
	lines := strings.Split(string(raw), "\n")
	if len(lines) > tail {
		lines = lines[len(lines)-tail:]
	}
	return map[string]any{"name": name, "logs": strings.Join(lines, "\n")}, nil
}
