---
sidebar_position: 5
---

# Security

Firewall, WAF, Fail2ban, SSH keys, ClamAV malware scanning, and audit logging. All host-side operations are proxied through the privileged Go agent; the panel never writes directly to the host file system.

All endpoints require `auth:sanctum` + `permission:security.manage` unless noted.

---

## Firewall (UFW)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/firewall` | `{ enabled, rules[], raw }` |
| `POST` | `/api/v1/security/firewall` | Actions below |
| `GET` | `/api/v1/security/firewall/allowlist` | Panel API IP allowlist |
| `POST` | `/api/v1/security/firewall/allowlist` | `{ ips }` comma-separated CIDRs |

**POST body actions:**

| `action` | Required fields | Description |
|----------|-----------------|-------------|
| `enable` | — | `ufw --force enable` |
| `disable` | — | `ufw disable` |
| `allow` | `port`, `proto` (`tcp`/`udp`), optional `from_ip` | Allow rule |
| `deny` | `port`, `proto`, optional `from_ip` | Deny rule |
| `delete` | `rule_num` | Remove rule by numbered index |
| `preset` | `preset` (`web`\|`ssh`) | Quick-add common rules |

Rules are parsed from `ufw status numbered`. The UI panel is at **Security → Firewall**.

---

## Web Application Firewall (WAF / ModSecurity)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/waf` | `{ enabled, conf }` |
| `POST` | `/api/v1/security/waf` | `{ enabled: bool }` — symlinks/removes ModSecurity config and reloads nginx |

The agent checks for the symlink at `WEBINO_MODSEC_CONF` (default `/etc/nginx/modules-enabled/50-mod-http-modsecurity.conf`). Toggling reloads nginx automatically. UI: **Security → WAF**.

---

## Fail2ban

### Jails

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/fail2ban` | `{ jails[{ name, detail }], raw }` |
| `POST` | `/api/v1/security/fail2ban/unban` | `{ jail, ip }` — unbans an IP from a jail |

### Filters

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/fail2ban/filters` | `{ filters[{ name, content }] }` |
| `POST` | `/api/v1/security/fail2ban/filters` | Create/update or delete a filter |

**Filter POST body:**

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Filter filename without `.conf`; `[a-zA-Z0-9._-]`, max 64 chars |
| `content` | string | Fail2ban filter INI content |
| `action` | `save`\|`delete` | Defaults to `save`; `delete` removes the file |

Filter files are written to `WEBINO_FAIL2BAN_FILTER_DIR` (default `/etc/fail2ban/filter.d`). Fail2ban is reloaded after each write or delete. UI: **Security → Fail2ban** (tabs: Jails / Filters / Unban).

---

## SSH Keys

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/sshkeys` | `{ keys[], path }` |
| `POST` | `/api/v1/security/sshkeys` | `{ action: "add"\|"delete", key, label? }` |

Manages `authorized_keys` at `WEBINO_SSH_AUTHKEYS` (default `/root/.ssh/authorized_keys`). The `delete` action matches by key prefix. UI: **Security → SSH Keys**.

---

## ClamAV Malware Scanning

### On-demand scan

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/security/clamav/scan` | `{ path? }` — runs `clamscan -r --infected`; result persisted to `clamav_scans` |

Response: `{ infected[], count, output, ok }`.

### Scan history

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/clamav/history` | Last 50 scan records ordered newest-first |

Each record: `{ id, path, status, infected[], count, started_at, finished_at, error }`.

`status` is one of `pending`, `running`, `completed`, `failed`.

### Scheduled scan settings

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/clamav/schedule` | `{ enabled, path }` |
| `POST` | `/api/v1/security/clamav/schedule` | `{ enabled: bool, path? }` |

When `enabled` is `true`, the Artisan scheduler runs `panel:clamav-scan <path>` **weekly**. The command respects `clamav_schedule_path` from `panel_settings`. Run manually with:

```bash
php artisan panel:clamav-scan /var/www
```

UI: **Security → ClamAV** (tabs: Scan / History / Schedule).

---

## Audit Log & Login History

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/security/audit-log` | Paginated audit entries (`user_id`, `action`, `target`, `ip`, `meta`) |
| `GET` | `/api/v1/security/login-history` | Paginated login attempts with success/failure flag |

Audit entries are written by `LogAuditAction` middleware on mutating API calls. Login history is recorded by the auth layer on every login attempt.

UI: **Security → Audit** (tabs: Audit log / Login history).
