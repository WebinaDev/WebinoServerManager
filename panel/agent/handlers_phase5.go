package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func handleGit(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		repos, err := listGitRepositories()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"repositories": repos})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action    string `json:"action"`
		Name      string `json:"name"`
		RepoURL   string `json:"repo_url"`
		Branch    string `json:"branch"`
		TargetDir string `json:"target_dir"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	abs, err := safeGitPath(body.TargetDir)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	switch body.Action {
	case "create":
		if body.RepoURL == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "repo_url required"})
			return
		}
		if err := validateGitRepoURL(body.RepoURL); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
			return
		}
		branch := body.Branch
		if branch == "" {
			branch = "main"
		}
		_ = os.MkdirAll(filepath.Dir(abs), 0o755)
		out, err := runArgv([]string{"git", "clone", "--branch", branch, body.RepoURL, abs}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "target_dir": body.TargetDir})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "pull":
		out, err := runArgv([]string{"git", "-C", abs, "pull"}, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "delete":
		if err := os.RemoveAll(abs); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"deleted": body.TargetDir})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func handleWordpress(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		sites, err := listWordpressSites()
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"sites": sites})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
		return
	}
	if r.Method != http.MethodPost {
		writeMethod(w)
		return
	}
	var body struct {
		Action         string `json:"action"`
		Domain         string `json:"domain"`
		Path           string `json:"path"`
		SourcePath     string `json:"source_path"`
		TargetPath     string `json:"target_path"`
		OldURL         string `json:"old_url"`
		NewURL         string `json:"new_url"`
		StagingDomain  string `json:"staging_domain"`
		ThemeSlug      string `json:"theme_slug"`
		PluginSlug     string `json:"plugin_slug"`
		All            bool   `json:"all"`
		Title          string `json:"title"`
		AdminUser      string `json:"admin_user"`
		AdminPass      string `json:"admin_password"`
		AdminEmail     string `json:"admin_email"`
		DbName         string `json:"db_name"`
		DbUser         string `json:"db_user"`
		DbPassword     string `json:"db_password"`
		DbHost         string `json:"db_host"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
		return
	}
	sitePath, err := safeFilePath(body.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: err.Error()})
		return
	}
	switch body.Action {
	case "install":
		_ = os.MkdirAll(sitePath, 0o755)
		if _, err := runArgv([]string{"wp", "core", "download", "--path=" + sitePath}, ""); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		dbHost := body.DbHost
		if dbHost == "" {
			dbHost = "127.0.0.1"
		}
		dbName := body.DbName
		if dbName == "" {
			dbName = strings.ReplaceAll(body.Domain, ".", "_")
		}
		configArgs := []string{
			"wp", "config", "create",
			"--path=" + sitePath,
			"--dbname=" + dbName,
			"--dbuser=" + body.DbUser,
			"--dbpass=" + body.DbPassword,
			"--dbhost=" + dbHost,
			"--skip-check",
		}
		if body.DbUser != "" {
			if _, err := runArgv(configArgs, ""); err != nil {
				writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
				return
			}
		}
		installArgs := []string{
			"wp", "core", "install",
			"--path=" + sitePath,
			"--url=https://" + body.Domain,
			"--title=" + body.Title,
			"--admin_user=" + body.AdminUser,
			"--admin_password=" + body.AdminPass,
			"--admin_email=" + body.AdminEmail,
			"--skip-email",
		}
		out, err := runArgv(installArgs, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"output": out, "path": body.Path})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "delete":
		if err := os.RemoveAll(sitePath); err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]string{"deleted": body.Path})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "clone":
		source := body.SourcePath
		if source == "" {
			source = body.Path
		}
		if body.TargetPath == "" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "target_path required"})
			return
		}
		result, err := wordpressClone(source, body.TargetPath)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "migrate":
		result, err := wordpressMigrate(body.Path, body.OldURL, body.NewURL)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "staging":
		source := body.SourcePath
		if source == "" {
			source = body.Path
		}
		target := body.TargetPath
		if target == "" {
			target = strings.TrimSuffix(source, "/") + "-staging"
		}
		result, err := wordpressStaging(source, target, body.StagingDomain)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "themes_list":
		raw, err := wordpressThemesList(sitePath)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"themes": json.RawMessage(raw)})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "themes_update":
		result, err := wordpressThemesUpdate(sitePath, body.ThemeSlug, body.All)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "plugins_list":
		raw, err := wordpressPluginsList(sitePath)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"plugins": json.RawMessage(raw)})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "plugins_update":
		result, err := wordpressPluginsUpdate(sitePath, body.PluginSlug, body.All)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "plugin_activate", "plugin_deactivate":
		mode := "activate"
		if body.Action == "plugin_deactivate" {
			mode = "deactivate"
		}
		result, err := wordpressPluginToggle(sitePath, body.PluginSlug, mode)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "theme_activate":
		result, err := wordpressThemeActivate(sitePath, body.ThemeSlug)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case "integrity":
		result, err := wordpressIntegrity(sitePath)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(result)
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
	}
}

func safeGitPath(p string) (string, error) {
	if strings.Contains(p, "..") {
		return "", fmt.Errorf("path outside git jail")
	}
	clean := filepath.Clean("/" + strings.TrimPrefix(p, "/"))
	rel := strings.TrimPrefix(clean, "/")
	abs := filepath.Join(gitRoot, rel)
	rootAbs, err := filepath.Abs(gitRoot)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(abs)
	if err != nil {
		return "", err
	}
	if targetAbs != rootAbs && !strings.HasPrefix(targetAbs, rootAbs+string(os.PathSeparator)) {
		return "", fmt.Errorf("path outside git jail")
	}
	return targetAbs, nil
}

func listGitRepositories() ([]map[string]string, error) {
	repos := make([]map[string]string, 0)
	err := filepath.Walk(gitRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || !info.IsDir() || info.Name() != ".git" {
			return nil
		}
		rel, relErr := filepath.Rel(gitRoot, filepath.Dir(path))
		if relErr != nil {
			return nil
		}
		rel = strings.TrimPrefix(filepath.ToSlash(rel), "./")
		repos = append(repos, map[string]string{"target_dir": rel})
		return nil
	})
	return repos, err
}

func listWordpressSites() ([]map[string]string, error) {
	sites := make([]map[string]string, 0)
	err := filepath.Walk(filesRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() || info.Name() != "wp-config.php" {
			return nil
		}
		rel, relErr := filepath.Rel(filesRoot, filepath.Dir(path))
		if relErr != nil {
			return nil
		}
		rel = strings.TrimPrefix(filepath.ToSlash(rel), "./")
		sites = append(sites, map[string]string{"path": rel})
		return nil
	})
	return sites, err
}
