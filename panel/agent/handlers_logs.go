package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

type logSource struct {
	Kind string
	Ref  string
}

var allowedLogSources = map[string]logSource{
	"nginx-error":  {Kind: "file", Ref: "/var/log/nginx/error.log"},
	"nginx-access": {Kind: "file", Ref: "/var/log/nginx/access.log"},
	"mail":         {Kind: "journal", Ref: "postfix"},
	"auth":         {Kind: "journal", Ref: "ssh"},
	"php-fpm":      {Kind: "journal", Ref: "php8.2-fpm"},
	"panel":        {Kind: "journal", Ref: "nginx"},
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	source := r.URL.Query().Get("source")
	if source == "" {
		names := make([]string, 0, len(allowedLogSources))
		for k := range allowedLogSources {
			names = append(names, k)
		}
		data, _ := json.Marshal(map[string]any{"sources": names})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	src, ok := allowedLogSources[source]
	if !ok {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "source not allowed"})
		return
	}
	lines, _ := strconv.Atoi(r.URL.Query().Get("lines"))
	if lines < 1 {
		lines = 100
	}
	if lines > 5000 {
		lines = 5000
	}
	out, err := tailLogSource(src, lines)
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
		return
	}
	data, _ := json.Marshal(map[string]string{"source": source, "content": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func tailLogSource(src logSource, lines int) (string, error) {
	switch src.Kind {
	case "journal":
		return runArgv([]string{"journalctl", "-u", src.Ref, "-n", fmt.Sprintf("%d", lines), "--no-pager"}, "")
	default:
		return runArgv([]string{"tail", "-n", fmt.Sprintf("%d", lines), src.Ref}, "")
	}
}

func isAllowedLogSource(name string) bool {
	_, ok := allowedLogSources[name]
	return ok
}
