package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

var allowedServices = map[string]bool{
	"nginx":     true,
	"postfix":   true,
	"dovecot":   true,
	"mariadb":   true,
	"mysql":     true,
	"pdns":      true,
	"php8.2-fpm": true,
	"php8.3-fpm": true,
	"rspamd":    true,
	"docker":    true,
}

func handleServices(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		services := listServices()
		data, _ := json.Marshal(map[string]any{"services": services})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body struct {
			Service string `json:"service"`
			Action  string `json:"action"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Service == "" || body.Action == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "service and action required"})
			return
		}
		if !allowedServices[body.Service] {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "service not allowed"})
			return
		}
		switch body.Action {
		case "start", "stop", "restart":
		default:
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid action"})
			return
		}
		out, err := runArgv([]string{"systemctl", body.Action, body.Service}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "service": body.Service, "action": body.Action})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

func listServices() []map[string]string {
	out := make([]map[string]string, 0, len(allowedServices))
	for svc := range allowedServices {
		active, _ := runArgv([]string{"systemctl", "is-active", svc}, "")
		enabled, _ := runArgv([]string{"systemctl", "is-enabled", svc}, "")
		out = append(out, map[string]string{
			"name":    svc,
			"active":  strings.TrimSpace(active),
			"enabled": strings.TrimSpace(enabled),
		})
	}
	return out
}

func isAllowedService(name string) bool {
	return allowedServices[name]
}
