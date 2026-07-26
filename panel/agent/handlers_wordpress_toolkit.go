package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var wpEntryNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

func wpRun(sitePath string, extra ...string) (string, error) {
	args := append([]string{"wp", "--path=" + sitePath}, extra...)
	return runArgv(args, "")
}

func copyWordpressTree(srcAbs, dstAbs string) error {
	if err := os.MkdirAll(dstAbs, 0o755); err != nil {
		return err
	}
	return filepath.Walk(srcAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, relErr := filepath.Rel(srcAbs, path)
		if relErr != nil {
			return relErr
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(dstAbs, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}
		in, openErr := os.Open(path)
		if openErr != nil {
			return openErr
		}
		defer in.Close()
		if mkErr := os.MkdirAll(filepath.Dir(target), 0o755); mkErr != nil {
			return mkErr
		}
		out, createErr := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, info.Mode())
		if createErr != nil {
			return createErr
		}
		defer out.Close()
		_, copyErr := io.Copy(out, in)
		return copyErr
	})
}

func wordpressClone(sourcePath, targetPath string) (map[string]string, error) {
	srcAbs, err := safeFilePath(sourcePath)
	if err != nil {
		return nil, err
	}
	dstAbs, err := safeFilePath(targetPath)
	if err != nil {
		return nil, err
	}
	if _, statErr := os.Stat(filepath.Join(srcAbs, "wp-config.php")); statErr != nil {
		return nil, fmt.Errorf("source is not a WordPress install")
	}
	if _, statErr := os.Stat(dstAbs); statErr == nil {
		return nil, fmt.Errorf("target path already exists")
	}
	if err := copyWordpressTree(srcAbs, dstAbs); err != nil {
		return nil, err
	}
	out, err := wpRun(dstAbs, "core", "is-installed")
	if err != nil {
		return nil, fmt.Errorf("clone verify failed: %w", err)
	}
	return map[string]string{"source": sourcePath, "target": targetPath, "output": out}, nil
}

func wordpressMigrate(sitePath, oldURL, newURL string) (map[string]string, error) {
	abs, err := safeFilePath(sitePath)
	if err != nil {
		return nil, err
	}
	if oldURL == "" || newURL == "" {
		return nil, fmt.Errorf("old_url and new_url required")
	}
	out, err := wpRun(abs, "search-replace", oldURL, newURL, "--all-tables")
	if err != nil {
		return nil, err
	}
	return map[string]string{"path": sitePath, "output": out}, nil
}

func wordpressStaging(sourcePath, stagingPath, stagingDomain string) (map[string]string, error) {
	if stagingDomain == "" {
		return nil, fmt.Errorf("staging_domain required")
	}
	cloneResult, err := wordpressClone(sourcePath, stagingPath)
	if err != nil {
		return nil, err
	}
	stagingAbs, err := safeFilePath(stagingPath)
	if err != nil {
		return nil, err
	}
	srcAbs, err := safeFilePath(sourcePath)
	if err != nil {
		return nil, err
	}
	oldURL, _ := wpRun(srcAbs, "option", "get", "siteurl")
	if strings.TrimSpace(oldURL) == "" {
		oldURL = "https://" + stagingDomain
	}
	newURL := "https://" + stagingDomain
	migrateOut, err := wpRun(stagingAbs, "search-replace", oldURL, newURL, "--all-tables")
	if err != nil {
		return nil, err
	}
	cloneResult["staging_domain"] = stagingDomain
	cloneResult["migrate_output"] = migrateOut
	return cloneResult, nil
}

func wordpressThemesList(sitePath string) (json.RawMessage, error) {
	out, err := wpRun(sitePath, "theme", "list", "--format=json")
	if err != nil {
		return nil, err
	}
	if !json.Valid([]byte(out)) {
		return json.RawMessage(`[]`), nil
	}
	return json.RawMessage(out), nil
}

func wordpressThemesUpdate(sitePath, slug string, all bool) (map[string]string, error) {
	args := []string{"theme", "update"}
	if all {
		args = append(args, "--all")
	} else if slug != "" {
		if !wpEntryNameRe.MatchString(slug) {
			return nil, fmt.Errorf("invalid theme slug")
		}
		args = append(args, slug)
	} else {
		return nil, fmt.Errorf("slug or all=true required")
	}
	out, err := wpRun(sitePath, args...)
	if err != nil {
		return nil, err
	}
	return map[string]string{"path": sitePath, "output": out}, nil
}

func wordpressPluginsList(sitePath string) (json.RawMessage, error) {
	out, err := wpRun(sitePath, "plugin", "list", "--format=json")
	if err != nil {
		return nil, err
	}
	if !json.Valid([]byte(out)) {
		return json.RawMessage(`[]`), nil
	}
	return json.RawMessage(out), nil
}

func wordpressPluginsUpdate(sitePath, slug string, all bool) (map[string]string, error) {
	args := []string{"plugin", "update"}
	if all {
		args = append(args, "--all")
	} else if slug != "" {
		if !wpEntryNameRe.MatchString(slug) {
			return nil, fmt.Errorf("invalid plugin slug")
		}
		args = append(args, slug)
	} else {
		return nil, fmt.Errorf("slug or all=true required")
	}
	out, err := wpRun(sitePath, args...)
	if err != nil {
		return nil, err
	}
	return map[string]string{"path": sitePath, "output": out}, nil
}

func wordpressIntegrity(sitePath string) (map[string]any, error) {
	out, err := wpRun(sitePath, "core", "verify-checksums")
	ok := err == nil
	result := map[string]any{
		"path":    sitePath,
		"ok":      ok,
		"output":  out,
	}
	if err != nil {
		result["error"] = err.Error()
	}
	return result, nil
}
