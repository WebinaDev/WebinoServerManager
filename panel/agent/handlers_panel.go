package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

func handlePanelSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		confPath := filepath.Join(webinaRoot, "panel", "network.json")
		settings := map[string]any{
			"bind_domain":  "",
			"http_port":    2090,
			"https_port":   2090,
			"ssl_enabled":  false,
		}
		if b, err := os.ReadFile(confPath); err == nil {
			_ = json.Unmarshal(b, &settings)
		}
		data, _ := json.Marshal(settings)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		if strVal(body["action"]) != "network" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
			return
		}
		confPath := filepath.Join(webinaRoot, "panel")
		_ = os.MkdirAll(confPath, 0o755)
		outPath := filepath.Join(confPath, "network.json")
		b, _ := json.Marshal(map[string]any{
			"bind_domain": strVal(body["bind_domain"]),
			"http_port":   intVal(body["http_port"], 2090),
			"https_port":  intVal(body["https_port"], 2090),
			"ssl_enabled": body["ssl_enabled"],
		})
		if err := os.WriteFile(outPath, b, 0o644); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"saved": outPath})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func handlePanelRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Confirm != "RESTART" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "confirm RESTART required"})
		return
	}
	out, err := runArgv([]string{"docker", "compose", "-f", filepath.Join(webinaRoot, "panel", "docker-compose.panel.yml"), "restart"}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handlePanelReboot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Confirm != "REBOOT" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "confirm REBOOT required"})
		return
	}
	out, err := runArgv([]string{"systemctl", "reboot"}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func handlePanelRepair(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Steps []string `json:"steps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	report := map[string]string{}
	for _, step := range body.Steps {
		switch step {
		case "health_socket":
			socket := envOr("WEBINO_AGENT_SOCKET", "/run/webino-agent.sock")
			_, err := os.Stat(socket)
			if err != nil {
				report[step] = err.Error()
			} else {
				report[step] = "ok"
			}
		case "migrate":
			out, err := runArgv([]string{"docker", "compose", "-f", filepath.Join(webinaRoot, "panel", "docker-compose.panel.yml"), "exec", "-T", "panel-api", "php", "artisan", "migrate", "--force"}, "")
			if err != nil {
				report[step] = err.Error()
			} else {
				report[step] = out
			}
		case "permission_seed":
			out, err := runArgv([]string{"docker", "compose", "-f", filepath.Join(webinaRoot, "panel", "docker-compose.panel.yml"), "exec", "-T", "panel-api", "php", "artisan", "db:seed", "--class=RolesPermissionsSeeder", "--force"}, "")
			if err != nil {
				report[step] = err.Error()
			} else {
				report[step] = out
			}
		case "report":
			report[step] = "completed"
		default:
			report[step] = "skipped"
		}
	}
	data, _ := json.Marshal(map[string]any{"report": report})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}
