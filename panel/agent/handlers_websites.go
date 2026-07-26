package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
)

func handleWebsiteComposer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	docRoot := strVal(body["document_root"])
	cmd := strVal(body["command"])
	if cmd == "" {
		cmd = "install"
	}
	if cmd != "install" && cmd != "update" {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "command must be install or update"})
		return
	}
	absRoot, err := safeFilePath(docRoot)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	composerJSON := filepath.Join(absRoot, "composer.json")
	if _, err := jailPathUnder(absRoot, composerJSON); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	out, err := runArgv([]string{"composer", cmd, "--no-interaction", "--working-dir="+absRoot}, "")
	if err != nil {
		writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
		return
	}
	data, _ := json.Marshal(map[string]string{"document_root": absRoot, "command": cmd, "output": out})
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}
