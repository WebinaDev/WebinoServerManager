package main

import (
	"fmt"
	"net"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	cronScheduleRe = regexp.MustCompile(`^[\d*,/-]+(\s+[\d*,/-]+){4,5}$`)
	safeNameRe     = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	domainRe       = regexp.MustCompile(`^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$`)
	sshKeyRe       = regexp.MustCompile(`^(ssh-(?:rsa|ed25519|ecdsa)|ecdsa-sha2-nistp\d+)\s+[A-Za-z0-9+/]+={0,3}(\s+[^\n]+)?$`)
)

var allowedPhpVersions = map[string]bool{
	"8.1": true, "8.2": true, "8.3": true, "8.4": true,
}

var allowedPhpSettings = map[string]bool{
	"pm.max_children":    true,
	"pm.start_servers":   true,
	"pm.min_spare_servers": true,
	"pm.max_spare_servers": true,
	"memory_limit":       true,
	"upload_max_filesize": true,
	"max_execution_time": true,
	"post_max_size":      true,
	"display_errors":     true,
	"max_input_time":     true,
}

func validateSafeName(name string, maxLen int) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name required")
	}
	if maxLen > 0 && len(name) > maxLen {
		return fmt.Errorf("name too long")
	}
	if strings.Contains(name, "..") || strings.ContainsAny(name, "/\\\x00") {
		return fmt.Errorf("invalid name")
	}
	if !safeNameRe.MatchString(name) {
		return fmt.Errorf("invalid name characters")
	}
	return nil
}

func validatePhpVersion(version string) error {
	version = strings.TrimSpace(version)
	if version == "" {
		return nil
	}
	if !allowedPhpVersions[version] {
		return fmt.Errorf("php version not allowed")
	}
	return nil
}

func validateDomain(domain string) error {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return fmt.Errorf("domain required")
	}
	if len(domain) > 253 || strings.Contains(domain, "..") || strings.ContainsAny(domain, "/\\\x00") {
		return fmt.Errorf("invalid domain")
	}
	if !domainRe.MatchString(domain) {
		return fmt.Errorf("invalid domain format")
	}
	return nil
}

func jailPathUnder(baseDir, child string) (string, error) {
	if err := validateSafeName(strings.TrimSuffix(filepath.Base(child), filepath.Ext(child)), 128); err != nil {
		// child may be a path segment; validate each component for traversal
		if strings.Contains(child, "..") || strings.ContainsAny(child, "\x00") {
			return "", fmt.Errorf("invalid path")
		}
	}
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return "", err
	}
	joined := filepath.Join(absBase, filepath.Clean("/"+strings.TrimPrefix(child, "/")))
	absJoined, err := filepath.Abs(joined)
	if err != nil {
		return "", err
	}
	if absJoined != absBase && !strings.HasPrefix(absJoined, absBase+string(filepath.Separator)) {
		return "", fmt.Errorf("path outside jail")
	}
	return absJoined, nil
}

func validatePhpPoolSettings(settings map[string]any) error {
	if settings == nil {
		return nil
	}
	for k := range settings {
		if !allowedPhpSettings[k] {
			return fmt.Errorf("setting not allowed: %s", k)
		}
	}
	return nil
}

func validateSshPublicKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("key required")
	}
	if strings.ContainsAny(key, "\n\r") {
		return fmt.Errorf("invalid key format")
	}
	if !sshKeyRe.MatchString(key) {
		return fmt.Errorf("invalid ssh public key")
	}
	return nil
}

func allowedWebinaArgs(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("args required")
	}
	switch args[0] {
	case "platform":
		if len(args) == 2 && (args[1] == "status" || args[1] == "init") {
			return nil
		}
	case "site":
		if len(args) >= 2 && args[1] == "list" {
			return nil
		}
		if len(args) >= 2 && args[1] == "create" {
			return validateSiteCreateArgs(args[2:])
		}
		if len(args) >= 2 && args[1] == "delete" {
			return validateSiteDeleteArgs(args[2:])
		}
	case "product":
		if len(args) == 2 && args[1] == "list" {
			return nil
		}
		if len(args) >= 3 && args[1] == "install" {
			if args[2] != "Webino" && args[2] != "WebinoERM" {
				return fmt.Errorf("product not allowed")
			}
			return validateProductInstallArgs(args[3:])
		}
	}
	return fmt.Errorf("webina command not allowed")
}

func validateSiteCreateArgs(flags []string) error {
	allowed := map[string]bool{"--slug": true, "--domain": true, "--product": true, "--alias": true, "--channel": true, "--env-patch-base64": true}
	for i := 0; i < len(flags); i++ {
		f := flags[i]
		if !allowed[f] {
			return fmt.Errorf("flag not allowed: %s", f)
		}
		if i+1 >= len(flags) {
			return fmt.Errorf("missing value for %s", f)
		}
		if strings.TrimSpace(flags[i+1]) == "" {
			return fmt.Errorf("empty value for %s", f)
		}
		i++
	}
	return nil
}

func validateSiteDeleteArgs(flags []string) error {
	hasSlug := false
	hasYes := false
	for i := 0; i < len(flags); i++ {
		switch flags[i] {
		case "--slug":
			if i+1 >= len(flags) || strings.TrimSpace(flags[i+1]) == "" {
				return fmt.Errorf("missing slug")
			}
			hasSlug = true
			i++
		case "--yes":
			hasYes = true
		default:
			return fmt.Errorf("flag not allowed: %s", flags[i])
		}
	}
	if !hasSlug || !hasYes {
		return fmt.Errorf("--slug and --yes required")
	}
	return nil
}

func validateProductInstallArgs(flags []string) error {
	if len(flags) == 0 {
		return nil
	}
	if len(flags) == 2 && flags[0] == "--channel" {
		switch flags[1] {
		case "Dev", "LTS", "Beta":
			return nil
		default:
			return fmt.Errorf("channel not allowed")
		}
	}
	return fmt.Errorf("invalid product install args")
}

func validateCronSchedule(schedule string) error {
	schedule = strings.TrimSpace(schedule)
	if schedule == "" {
		return fmt.Errorf("schedule required")
	}
	if !cronScheduleRe.MatchString(schedule) {
		return fmt.Errorf("invalid cron schedule")
	}
	return nil
}

var cronDeniedBinaries = []string{
	"curl", "wget", "nc", "ncat", "netcat", "bash", "sh", "python", "python3",
	"perl", "ruby", "docker", "sudo", "su", "chmod", "chown", "rm", "mv",
}

func validateCronCommand(command string) error {
	command = strings.TrimSpace(command)
	if command == "" {
		return fmt.Errorf("command required")
	}
	if len(command) > 512 {
		return fmt.Errorf("command too long")
	}
	if strings.ContainsAny(command, "\n\r;|&$`()><") {
		return fmt.Errorf("invalid characters in command")
	}
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return fmt.Errorf("command required")
	}
	bin := strings.ToLower(filepath.Base(fields[0]))
	if strings.HasPrefix(fields[0], "/usr/local/lib/webino/cron-") {
		return nil
	}
	for _, denied := range cronDeniedBinaries {
		if bin == denied {
			return fmt.Errorf("command binary not allowed")
		}
	}
	return nil
}

func validateUfwPort(port string) error {
	port = strings.TrimSpace(port)
	if port == "" {
		return fmt.Errorf("port required")
	}
	if strings.Contains(port, "/") {
		parts := strings.SplitN(port, "/", 2)
		if err := validateUfwPort(parts[0]); err != nil {
			return err
		}
		return validateUfwProto(parts[1])
	}
	if strings.Contains(port, "-") {
		parts := strings.SplitN(port, "-", 2)
		for _, p := range parts {
			if err := validateUfwPort(p); err != nil {
				return err
			}
		}
		return nil
	}
	for _, ch := range port {
		if ch < '0' || ch > '9' {
			return fmt.Errorf("invalid port")
		}
	}
	return nil
}

func validateUfwProto(proto string) error {
	switch strings.ToLower(strings.TrimSpace(proto)) {
	case "tcp", "udp":
		return nil
	default:
		return fmt.Errorf("invalid proto")
	}
}

func validateIpAddress(ip string) error {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return fmt.Errorf("ip required")
	}
	if strings.Contains(ip, "/") {
		_, _, err := net.ParseCIDR(ip)
		if err != nil {
			return fmt.Errorf("invalid ip or cidr")
		}
		return nil
	}
	if net.ParseIP(ip) == nil {
		return fmt.Errorf("invalid ip")
	}
	return nil
}

func validateDockerCommand(command string) error {
	command = strings.TrimSpace(command)
	if command == "" {
		return nil
	}
	if strings.ContainsAny(command, "\n\r;|&$`") {
		return fmt.Errorf("invalid docker command")
	}
	return nil
}

func validateGitRepoURL(repoURL string) error {
	repoURL = strings.TrimSpace(repoURL)
	if repoURL == "" {
		return fmt.Errorf("repo_url required")
	}
	lower := strings.ToLower(repoURL)
	if strings.HasPrefix(lower, "file://") || strings.HasPrefix(lower, "git@") {
		return fmt.Errorf("repo_url scheme not allowed")
	}
	if !strings.HasPrefix(lower, "https://") {
		return fmt.Errorf("repo_url must use https")
	}
	return nil
}

func validateDockerRestartPolicy(policy string) error {
	switch strings.TrimSpace(policy) {
	case "no", "always", "on-failure", "unless-stopped":
		return nil
	default:
		return fmt.Errorf("invalid restart policy")
	}
}

func validateDockerPortMapping(mapping string) error {
	mapping = strings.TrimSpace(mapping)
	if mapping == "" {
		return fmt.Errorf("invalid port mapping")
	}
	parts := strings.Split(mapping, ":")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return fmt.Errorf("invalid port mapping")
		}
		for _, ch := range part {
			if ch < '0' || ch > '9' {
				return fmt.Errorf("invalid port mapping")
			}
		}
	}
	return nil
}
