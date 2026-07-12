package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

type config struct {
	BaseURL string `json:"base_url"`
	Token   string `json:"token"`
}

type loginResponse struct {
	Token               string `json:"token"`
	TwoFactorRequired   bool   `json:"two_factor_required"`
	Message             string `json:"message"`
}

func main() {
	jsonOut := flag.Bool("json", false, "print raw JSON response")
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		printUsage()
		os.Exit(1)
	}

	switch args[0] {
	case "login":
		if len(args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: wpanel login <base-url> <username>")
			os.Exit(1)
		}
		password := os.Getenv("WPANEL_PASSWORD")
		if password == "" && len(args) >= 4 {
			password = args[3]
		}
		if password == "" {
			fmt.Fprint(os.Stderr, "Password: ")
			reader := bufio.NewReader(os.Stdin)
			line, err := reader.ReadString('\n')
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			password = strings.TrimSpace(line)
		}
		if password == "" {
			fmt.Fprintln(os.Stderr, "password required (stdin, WPANEL_PASSWORD, or 4th arg)")
			os.Exit(1)
		}
		if err := cmdLogin(args[1], args[2], password); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println("logged in")
	case "config":
		cfg, err := loadConfig()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Printf("base_url=%s\n", cfg.BaseURL)
	case "api":
		if err := cmdRawAPI(args[1:], *jsonOut); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	default:
		if err := cmdAPI(args, *jsonOut); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}
}

func printUsage() {
	fmt.Println(`wpanel — WebinoServer panel CLI

  wpanel login <base-url> <username>
  wpanel config
  wpanel api <METHOD> <path> [--json body]

  wpanel auth user
  wpanel auth tokens
  wpanel auth tokens create <name> [--abilities a,b]
  wpanel auth tokens revoke <id>

  wpanel domains list
  wpanel domains create <domain> [--slug name]
  wpanel domains delete <id>

  wpanel databases list
  wpanel databases create <name> [--engine mysql|pgsql]

  wpanel webhooks list
  wpanel webhooks create <name> <url> --events e1,e2
  wpanel webhooks delete <id>

  wpanel apps list
  wpanel monitoring services

Password for login: WPANEL_PASSWORD env, stdin prompt, or optional 4th argument.
2FA: WPANEL_OTP or WPANEL_RECOVERY_CODE env, or stdin prompt on 422.

Global flags:
  --json   print raw JSON response`)
}

func configPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "wpanel", "config.json"), nil
}

func loadConfig() (*config, error) {
	path, err := configPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("not logged in — run wpanel login first")
	}
	var cfg config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.BaseURL == "" || cfg.Token == "" {
		return nil, fmt.Errorf("invalid config at %s", path)
	}
	return &cfg, nil
}

func saveConfig(cfg *config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func cmdLogin(baseURL, username, password string) error {
	baseURL = strings.TrimRight(baseURL, "/")
	otp := os.Getenv("WPANEL_OTP")
	recovery := os.Getenv("WPANEL_RECOVERY_CODE")

	for attempt := 0; attempt < 2; attempt++ {
		body := map[string]string{
			"username": username,
			"password": password,
		}
		if otp != "" {
			body["otp"] = otp
		}
		if recovery != "" {
			body["recovery_code"] = recovery
		}

		raw, status, err := doRequest(http.MethodPost, baseURL+"/api/v1/auth/login", "", body)
		if err != nil {
			return err
		}

		var out loginResponse
		if err := json.Unmarshal(raw, &out); err != nil {
			return err
		}

		if status == 200 && out.Token != "" {
			return saveConfig(&config{BaseURL: baseURL, Token: out.Token})
		}

		if status == 422 && out.TwoFactorRequired {
			if otp == "" && recovery == "" {
				otp, recovery = prompt2FA()
			}
			if otp == "" && recovery == "" {
				return fmt.Errorf("two-factor authentication required")
			}
			continue
		}

		return fmt.Errorf("login failed: %s", string(raw))
	}

	return fmt.Errorf("login failed after 2FA attempt")
}

func prompt2FA() (otp, recovery string) {
	otp = os.Getenv("WPANEL_OTP")
	recovery = os.Getenv("WPANEL_RECOVERY_CODE")
	if otp != "" || recovery != "" {
		return otp, recovery
	}
	fmt.Fprint(os.Stderr, "OTP (6 digits, or leave empty): ")
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	otp = strings.TrimSpace(line)
	if otp != "" {
		return otp, ""
	}
	fmt.Fprint(os.Stderr, "Recovery code: ")
	line, _ = reader.ReadString('\n')
	recovery = strings.TrimSpace(line)
	return "", recovery
}

func cmdRawAPI(args []string, jsonOut bool) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: wpanel api <METHOD> <path> [--json body]")
	}
	method := strings.ToUpper(args[0])
	path := args[1]
	var body any
	for i := 2; i < len(args); i++ {
		if args[i] == "--json" && i+1 < len(args) {
			if err := json.Unmarshal([]byte(args[i+1]), &body); err != nil {
				return fmt.Errorf("invalid --json: %w", err)
			}
			break
		}
	}
	return authenticatedRequest(method, path, body, jsonOut)
}

func cmdAPI(args []string, jsonOut bool) error {
	if len(args) == 0 {
		return fmt.Errorf("unknown command")
	}

	switch args[0] {
	case "auth":
		return cmdAuth(args[1:], jsonOut)
	case "domains":
		return cmdDomains(args[1:], jsonOut)
	case "databases":
		return cmdDatabases(args[1:], jsonOut)
	case "webhooks":
		return cmdWebhooks(args[1:], jsonOut)
	case "apps":
		if len(args) == 2 && args[1] == "list" {
			return authenticatedRequest(http.MethodGet, "/api/v1/apps", nil, jsonOut)
		}
	case "monitoring":
		if len(args) == 2 && args[1] == "services" {
			return authenticatedRequest(http.MethodGet, "/api/v1/monitoring/services", nil, jsonOut)
		}
	}

	return fmt.Errorf("unknown command: %s", strings.Join(args, " "))
}

func cmdAuth(args []string, jsonOut bool) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: wpanel auth user|tokens ...")
	}
	switch args[0] {
	case "user":
		return authenticatedRequest(http.MethodGet, "/api/v1/auth/user", nil, jsonOut)
	case "tokens":
		if len(args) == 1 {
			return authenticatedRequest(http.MethodGet, "/api/v1/auth/tokens", nil, jsonOut)
		}
		switch args[1] {
		case "create":
			if len(args) < 3 {
				return fmt.Errorf("usage: wpanel auth tokens create <name> [--abilities a,b]")
			}
			body := map[string]any{"name": args[2]}
			for i := 3; i < len(args); i++ {
				if args[i] == "--abilities" && i+1 < len(args) {
					body["abilities"] = strings.Split(args[i+1], ",")
				}
			}
			return authenticatedRequest(http.MethodPost, "/api/v1/auth/tokens", body, jsonOut)
		case "revoke":
			if len(args) < 3 {
				return fmt.Errorf("usage: wpanel auth tokens revoke <id>")
			}
			return authenticatedRequest(http.MethodDelete, "/api/v1/auth/tokens/"+args[2], nil, jsonOut)
		}
	}
	return fmt.Errorf("unknown auth command: %s", strings.Join(args, " "))
}

func cmdDomains(args []string, jsonOut bool) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: wpanel domains list|create|delete ...")
	}
	switch args[0] {
	case "list":
		return authenticatedRequest(http.MethodGet, "/api/v1/domains", nil, jsonOut)
	case "create":
		if len(args) < 2 {
			return fmt.Errorf("usage: wpanel domains create <domain> [--slug name]")
		}
		body := map[string]string{"domain": args[1]}
		for i := 2; i < len(args); i++ {
			if args[i] == "--slug" && i+1 < len(args) {
				body["slug"] = args[i+1]
			}
		}
		return authenticatedRequest(http.MethodPost, "/api/v1/domains", body, jsonOut)
	case "delete":
		if len(args) < 2 {
			return fmt.Errorf("usage: wpanel domains delete <id>")
		}
		return authenticatedRequest(http.MethodDelete, "/api/v1/domains/"+args[1], nil, jsonOut)
	}
	return fmt.Errorf("unknown domains command: %s", args[0])
}

func cmdDatabases(args []string, jsonOut bool) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: wpanel databases list|create ...")
	}
	switch args[0] {
	case "list":
		return authenticatedRequest(http.MethodGet, "/api/v1/databases", nil, jsonOut)
	case "create":
		if len(args) < 2 {
			return fmt.Errorf("usage: wpanel databases create <name> [--engine mysql|pgsql]")
		}
		body := map[string]string{"name": args[1], "engine": "mysql"}
		for i := 2; i < len(args); i++ {
			if args[i] == "--engine" && i+1 < len(args) {
				body["engine"] = args[i+1]
			}
		}
		return authenticatedRequest(http.MethodPost, "/api/v1/databases", body, jsonOut)
	}
	return fmt.Errorf("unknown databases command: %s", args[0])
}

func cmdWebhooks(args []string, jsonOut bool) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: wpanel webhooks list|create|delete ...")
	}
	switch args[0] {
	case "list":
		return authenticatedRequest(http.MethodGet, "/api/v1/webhooks", nil, jsonOut)
	case "create":
		if len(args) < 3 {
			return fmt.Errorf("usage: wpanel webhooks create <name> <url> --events e1,e2")
		}
		body := map[string]any{
			"name":   args[1],
			"url":    args[2],
			"events": []string{},
		}
		for i := 3; i < len(args); i++ {
			if args[i] == "--events" && i+1 < len(args) {
				body["events"] = strings.Split(args[i+1], ",")
			}
		}
		events, _ := body["events"].([]string)
		if len(events) == 0 {
			return fmt.Errorf("--events required")
		}
		return authenticatedRequest(http.MethodPost, "/api/v1/webhooks", body, jsonOut)
	case "delete":
		if len(args) < 2 {
			return fmt.Errorf("usage: wpanel webhooks delete <id>")
		}
		return authenticatedRequest(http.MethodDelete, "/api/v1/webhooks/"+args[1], nil, jsonOut)
	}
	return fmt.Errorf("unknown webhooks command: %s", args[0])
}

func authenticatedRequest(method, path string, body any, jsonOut bool) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	var raw []byte
	var status int
	if body != nil {
		raw, status, err = doRequest(method, cfg.BaseURL+path, cfg.Token, body)
	} else {
		raw, status, err = doRequest(method, cfg.BaseURL+path, cfg.Token, nil)
	}
	if err != nil {
		return err
	}
	if status >= 400 {
		return fmt.Errorf("request failed (%d): %s", status, string(raw))
	}
	if jsonOut {
		fmt.Println(string(raw))
		return nil
	}
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, raw, "", "  "); err != nil {
		fmt.Println(string(raw))
		return nil
	}
	fmt.Println(pretty.String())
	return nil
}

func doRequest(method, url, token string, body any) ([]byte, int, error) {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	return raw, res.StatusCode, nil
}
