package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func recycleRoot() string {
	return envOr("WEBINO_RECYCLE_ROOT", filepath.Join(filesRoot, ".webino-recycle"))
}

func versionsRoot() string {
	return envOr("WEBINO_VERSIONS_ROOT", filepath.Join(filesRoot, ".webino-versions"))
}

func handleFilesAdvanced(action, path, dest, content, query, url string, maxDepth, maxHits int) (any, error) {
	switch action {
	case "search":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		if query == "" {
			return nil, fmt.Errorf("query required")
		}
		if maxDepth <= 0 {
			maxDepth = 4
		}
		if maxHits <= 0 {
			maxHits = 100
		}
		hits := searchFiles(abs, query, maxDepth, maxHits)
		return map[string]any{"hits": hits}, nil
	case "recycle":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		_ = os.MkdirAll(recycleRoot(), 0o750)
		id := time.Now().UTC().Format("20060102T150405") + "-" + randomHex(4)
		meta := map[string]string{"original": path, "id": id}
		destDir := filepath.Join(recycleRoot(), id)
		if err := os.MkdirAll(destDir, 0o750); err != nil {
			return nil, err
		}
		base := filepath.Base(abs)
		if err := os.Rename(abs, filepath.Join(destDir, base)); err != nil {
			// cross-device fallback: copy+remove not needed if same FS; report
			return nil, err
		}
		b, _ := json.Marshal(meta)
		_ = os.WriteFile(filepath.Join(destDir, ".meta.json"), b, 0o640)
		return map[string]any{"id": id, "path": path}, nil
	case "recycle_list":
		_ = os.MkdirAll(recycleRoot(), 0o750)
		entries, err := os.ReadDir(recycleRoot())
		if err != nil {
			return nil, err
		}
		items := []map[string]any{}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			metaPath := filepath.Join(recycleRoot(), e.Name(), ".meta.json")
			b, err := os.ReadFile(metaPath)
			item := map[string]any{"id": e.Name()}
			if err == nil {
				var m map[string]string
				_ = json.Unmarshal(b, &m)
				item["original"] = m["original"]
			}
			items = append(items, item)
		}
		return map[string]any{"items": items}, nil
	case "recycle_restore":
		id := filepath.Base(path) // reuse path field as id
		if id == "" || strings.Contains(id, "..") {
			return nil, fmt.Errorf("invalid id")
		}
		dir := filepath.Join(recycleRoot(), id)
		metaPath := filepath.Join(dir, ".meta.json")
		b, err := os.ReadFile(metaPath)
		if err != nil {
			return nil, err
		}
		var m map[string]string
		if err := json.Unmarshal(b, &m); err != nil {
			return nil, err
		}
		orig := m["original"]
		destAbs, err := safeFilePath(orig)
		if err != nil {
			return nil, err
		}
		_ = os.MkdirAll(filepath.Dir(destAbs), 0o755)
		entries, _ := os.ReadDir(dir)
		for _, e := range entries {
			if e.Name() == ".meta.json" {
				continue
			}
			src := filepath.Join(dir, e.Name())
			if err := os.Rename(src, destAbs); err != nil {
				return nil, err
			}
			break
		}
		_ = os.RemoveAll(dir)
		return map[string]any{"restored": orig}, nil
	case "recycle_purge":
		id := filepath.Base(path)
		if id == "" || strings.Contains(id, "..") {
			return nil, fmt.Errorf("invalid id")
		}
		dir := filepath.Join(recycleRoot(), id)
		if !strings.HasPrefix(dir, recycleRoot()+string(os.PathSeparator)) {
			return nil, fmt.Errorf("invalid recycle path")
		}
		if err := os.RemoveAll(dir); err != nil {
			return nil, err
		}
		return map[string]any{"purged": id}, nil
	case "remote_download":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			return nil, fmt.Errorf("url must be http(s)")
		}
		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Get(url)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("download status %d", resp.StatusCode)
		}
		_ = os.MkdirAll(filepath.Dir(abs), 0o755)
		f, err := os.Create(abs)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		n, err := io.Copy(f, io.LimitReader(resp.Body, 50<<20)) // 50MB cap
		if err != nil {
			return nil, err
		}
		return map[string]any{"path": path, "bytes": n}, nil
	case "versions":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		dir := versionDirFor(abs)
		_ = os.MkdirAll(dir, 0o750)
		entries, err := os.ReadDir(dir)
		if err != nil {
			return nil, err
		}
		versions := []string{}
		for _, e := range entries {
			if !e.IsDir() {
				versions = append(versions, e.Name())
			}
		}
		return map[string]any{"versions": versions, "path": path}, nil
	case "restore_version":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		ver := dest
		if ver == "" {
			return nil, fmt.Errorf("version required in dest")
		}
		src := filepath.Join(versionDirFor(abs), filepath.Base(ver))
		b, err := os.ReadFile(src)
		if err != nil {
			return nil, err
		}
		_ = saveFileVersion(abs)
		if err := os.WriteFile(abs, b, 0o644); err != nil {
			return nil, err
		}
		return map[string]any{"path": path, "version": ver}, nil
	case "compress":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		destAbs := abs + ".zip"
		if dest != "" {
			destAbs, err = safeFilePath(dest)
			if err != nil {
				return nil, err
			}
		}
		if !strings.HasSuffix(strings.ToLower(destAbs), ".zip") {
			destAbs += ".zip"
		}
		info, err := os.Stat(abs)
		if err != nil {
			return nil, err
		}
		var argv []string
		if info.IsDir() {
			base := filepath.Base(abs)
			argv = []string{"zip", "-r", destAbs, base}
			_, err = runArgv(argv, filepath.Dir(abs))
		} else {
			argv = []string{"zip", "-j", destAbs, abs}
			_, err = runArgv(argv, "")
		}
		if err != nil {
			return nil, err
		}
		return map[string]any{"path": path, "archive": destAbs}, nil
	case "decompress":
		abs, err := safeFilePath(path)
		if err != nil {
			return nil, err
		}
		if !strings.HasSuffix(strings.ToLower(abs), ".zip") {
			return nil, fmt.Errorf("only .zip archives supported")
		}
		outDir := filepath.Dir(abs)
		if dest != "" {
			outDir, err = safeFilePath(dest)
			if err != nil {
				return nil, err
			}
		}
		_ = os.MkdirAll(outDir, 0o755)
		_, err = runArgv([]string{"unzip", "-o", abs, "-d", outDir}, "")
		if err != nil {
			return nil, err
		}
		return map[string]any{"path": path, "dest": outDir}, nil
	default:
		return nil, fmt.Errorf("unknown advanced action")
	}
}

func searchFiles(root, query string, maxDepth, maxHits int) []map[string]string {
	q := strings.ToLower(query)
	hits := []map[string]string{}
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || len(hits) >= maxHits {
			return filepath.SkipAll
		}
		rel, _ := filepath.Rel(root, path)
		depth := 0
		if rel != "." {
			depth = strings.Count(rel, string(os.PathSeparator)) + 1
		}
		if depth > maxDepth {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		name := strings.ToLower(d.Name())
		if strings.Contains(name, q) {
			relFromJail, _ := filepath.Rel(filesRoot, path)
			hits = append(hits, map[string]string{
				"path":  "/" + filepath.ToSlash(relFromJail),
				"name":  d.Name(),
				"is_dir": fmt.Sprintf("%t", d.IsDir()),
			})
		}
		if d.IsDir() || d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		// content search for small text files
		info, err := d.Info()
		if err != nil || info.Size() > 256*1024 {
			return nil
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		if strings.Contains(strings.ToLower(string(b)), q) {
			relFromJail, _ := filepath.Rel(filesRoot, path)
			hits = append(hits, map[string]string{
				"path":    "/" + filepath.ToSlash(relFromJail),
				"name":    d.Name(),
				"match":   "content",
				"is_dir":  "false",
			})
		}
		return nil
	})
	return hits
}

func versionDirFor(abs string) string {
	rel, err := filepath.Rel(filesRoot, abs)
	if err != nil {
		rel = filepath.Base(abs)
	}
	safe := strings.ReplaceAll(filepath.ToSlash(rel), "/", "__")
	return filepath.Join(versionsRoot(), safe)
}

func saveFileVersion(abs string) error {
	b, err := os.ReadFile(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	dir := versionDirFor(abs)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	name := time.Now().UTC().Format("20060102T150405") + "-" + randomHex(3)
	if err := os.WriteFile(filepath.Join(dir, name), b, 0o640); err != nil {
		return err
	}
	// keep last 10
	entries, _ := os.ReadDir(dir)
	if len(entries) > 10 {
		// remove oldest (name sorted chronologically)
		for i := 0; i < len(entries)-10; i++ {
			_ = os.Remove(filepath.Join(dir, entries[i].Name()))
		}
	}
	return nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
