# aaPanel ↔ WebinoServerManager Parity Matrix (SSOT)

**Scope decision:** C (Free + Pro-class, including Apache dual-stack) + R (gap matrix + wave map; no feature code in Wave 0).  
**Reference:** [aaPanel/aaPanel](https://github.com/aaPanel/aaPanel) · [Home menu](https://www.aapanel.com/docs/Function/Home.html) · [Feature list](https://www.aapanel.com/new/feature.html)  
**Architecture (immutable):** Laravel nwidart modules → REST `/api/v1` → Go agent (Unix socket) → host; panel MariaDB + `panel:reconcile-host`; Next.js + shadcn; i18n fa/en; OpenAPI. **Do not port aaPanel Python.**

**Status legend**

| Status | Meaning |
|--------|---------|
| **Have** | Operational coverage roughly matching aaPanel free core for that capability |
| **Partial** | Page/API exists; depth below aaPanel (esp. Free+Pro surface) |
| **Missing** | Must be built |
| **N/A** | Won't-fix or out of mandatory parity |

**Product decisions**

| Item | Decision |
|------|----------|
| Apache / HTTP-3 (was Phase 28.9 won't-fix) | **Have** — Wave 2 |
| One-click / App Store (was Phase 28.2 ERP-deferred) | **Have** — Wave 3 (`Softstore`) |
| Reseller hierarchy / multi-tier branding | **Won't-fix** — shared hosting via Hosting plans/accounts + Users RBAC |
| aaPanel UI/branding / commercial license APIs | **N/A** — capability parity only |
| aaPanel AI assistant | **N/A** |
| Load balance / multi-node | **N/A** until Softstore stable; lowest priority |

---

## 1. Summary matrix

| aaPanel | SM equivalent (today) | Status | Primary gap | Target module(s) | Agent surface (today / needed) | UI path (today / planned) | Wave |
|---------|----------------------|--------|-------------|------------------|-------------------------------|---------------------------|------|
| Home | Dashboard `/` | **Have** (Wave 5 + Phase E) | — | Core, Metrics, Monitoring, Security, Softstore | `/v1/system/info` + processes | `/` | 5+E |
| Website | `/websites` hub + Domains/Subdomains/Webserver | **Have** (Wave 1 + Phase E) | — | Websites (+ Webserver, Ftp, Databases, Php, Ssl) | `/v1/vhosts` + composer + per-site logs | `/websites`, `/websites/[id]` | 1+E |
| WP Toolkit | Wordpress | **Have** (Wave 8 + Phase E) | — | Wordpress | `/v1/wordpress` | `/wordpress` | 8+E |
| FTP | Ftp | **Have** (Wave 10) | — | Ftp | `/v1/ftp/accounts` + `/v1/ftp/service` | `/ftp` | 10 |
| Databases | Databases + Embed | **Have** (Wave 10 + Phase D/E) | — | Databases | `/v1/databases*` + Mongo/Redis/tools | `/databases` | 10+E |
| Docker | Apps | **Have** (Wave 4 + Phase D/E) | — | Apps + Softstore | `/v1/docker/*` compose/net/vol/registry/daemon + container terminal | `/apps`, `/terminal` | 4+E |
| Monitor | Monitoring + Metrics | **Have** (Wave 5 + Phase E) | — | Monitoring, Metrics | `/v1/services`, `/v1/logs`, processes, system/info IO | `/monitoring/*`, `/metrics-alerts` | 5+E |
| Security | Security | **Have** (Wave 6 + Phase E) | heavy vuln scan out of scope | Security | risks, waf sites/logs, tamper | `/security/*` | 6+E |
| WAF | Security WAF | **Have** (Wave 6 + Phase D/E) | Heavy vuln scan out of scope | Security | `/v1/security/waf` + sites/logs/geo | `/security/waf` | 6+E |
| Mail Server | Email + Webmail | **Have** (Wave 11 lists UX) | bulk marketing send low priority | Email | `/v1/mail/*` | `/email/*`, `/webmail` | 11 |
| Files | Files | **Have** (Wave 7) | — | Files | `/v1/files` advanced | `/files` | 7 |
| Logs | Monitoring logs | **Have** (Phase D + Phase E) | — | Monitoring | `/v1/logs` grouped panel/site/FTP | `/monitoring/logs` | 5+E |
| Node / runtimes | Runtimes | **Have** (Phase D) | — | **Runtimes** | `/v1/runtimes/*` + Java via Softstore | `/runtimes` | 9 |
| Domains (DNS APIs) | Dns + Ssl | **Have** (Wave 10 + Phase D) | Additional providers later | Dns, Ssl | `/v1/dns/providers/cloudflare` + `alidns` | `/dns`, `/ssl` | 10 |
| Account | Hosting + Users | **Have** (Phase D) | Reseller tree N/A | Hosting, Users | hosting provision/usage/quota-alerts | `/hosting/*`, `/users` | 10–12 |
| Terminal | Terminal | **Have** (Phase D) | — | Terminal, Apps | WS PTY + optional `container` attach | `/terminal`, `/apps` deep-link | 4–5 |
| Cron | Cron | **Have** (Wave 10) | — | Cron | `/v1/cron` typed + scripts | `/cron` | 10 |
| App Store | Softstore seeded catalog | **Have** (Waves 3–4 + Phase E) | — | **Softstore** | install/upgrade/uninstall allowlist + docker compose templates | `/softstore` | 3–4+E |
| Settings | Profile + System + Setup | **Have** (Wave 12 + Phase E) | — | Core, System | `/v1/panel/*` | `/settings` | 12+E |
| Apache / OLS | Webserver dual-stack | Have (Wave 2; OLS out of scope) | — | Webserver | `/v1/vhosts` Apache + HTTP/3 nginx | `/webserver/vhosts`, `/websites` | 2 |
| Disk analysis | System | **Have** (Wave 6) | — | System | `/v1/system/disk` | `/system/disk` | 6 |
| Tamper / file monitor | Security | **Have** (Wave 6) | — | Security | `/v1/security/tamper` | `/security/tamper` | 6 |
| Site analytics | Websites | **Have** (Wave 6 + Phase E) | — | Websites | `/v1/websites/analytics` | Website hub Analytics tab | 6+E |
| Load balance / multi-node | — | N/A | After Softstore; lowest priority | — | — | — | — |
| AI assistant | — | N/A | Out of mandatory parity | — | — | — | — |

---

## 2. Detail by aaPanel area

### 2.1 Home

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| OS / arch / version | System info + dashboard + Settings version | — | 12+E |
| CPU/RAM/disk gauges | **Have** | — | 5 |
| NIC traffic / Disk IO | **Have** (sparklines + metrics link) | — | 5+E |
| Counters sites/FTP/DB | Hosting + dashboard KPIs (clickable) | — | 5+E |
| Security risk widget | **Have** (lightweight signals) | Full scanner Wave 6 | 5–6 |
| Software pins | **Have** Softstore pins on Home | — | 3 |
| Install task / message box | **Have** recent installs on Home | — | 3, 5 |
| TOP5 processes | **Have** | — | 5 |

**Mapping:** `DashboardController`, `DashboardHome.tsx`, system info + processes handlers, Metrics sample jobs.

### 2.2 Website (unified hub)

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Site CRUD PHP/static | **Have** `/websites` | — | 1 |
| Create + PHP + FTP + MySQL | **Have** orchestration | DNS auto-record still via Dns module | 1 |
| Domains/aliases | **Have** aliases on website → nginx | — | 1 |
| Docroot / run dir | **Have** | — | 1 |
| htpasswd / deny paths | **Have** | — | 1 |
| Traffic control / quota | **Have** per-site `limit_rate` | Analytics later | 1, 5 |
| Rewrite templates | **Have** WP/Laravel/custom | — | 1 |
| SSL apply / force HTTPS / HSTS | **Have** hub + optional issue | — | 1 |
| PHP version per site | **Have** pool bind + create pool | — | 1 |
| Redirect / reverse proxy | Webserver Have | Deep-link from hub | 1 |
| Hotlink protection | **Have** | — | 1 |
| Access/error logs | **Have** per-site sources | Richer analysis Wave 5 | 1, 5 |
| Composer per site | **Have** install/update | Softstore catalog Wave 3 | 1, 3 |
| Project types Node/Python/… | **Have** (incl. Java) | — | 9 |
| Apache engine | **Have** | — | 2 |

**Mapping:** `DomainController`, `SubdomainController`, `Vhost*` + `handlers_vhost.go`, `handlers_ssl.go`, `handlers_php_ini.go`.

### 2.3 WP Toolkit

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Install / list / basic wp-cli | **Have** | — | — |
| Themes / plugins manage | **Have** | Per-item update UI later | 8 |
| Clone / migrate / staging | **Have** | — | 8 |
| Integrity / security tools | **Have** checksum verify | Hardening tools later | 8 |
| Backup/restore WP | Via Backup module (Wave 11) | — | 11 |

**Mapping:** `Wordpress` module, `/v1/wordpress`, `WordpressPage.tsx`.

### 2.4 FTP

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Account CRUD + jail | **Have** | — | — |
| Enable/disable, quota | **Have** | — | — |
| Passive ports / service | **Have** | `/v1/ftp/service` notes | — |
| FTP log analysis | **Have** | Grouped under Monitoring logs (Phase D) | — |

**Mapping:** `Ftp` module, `/v1/ftp/accounts`, `FtpPage.tsx`.

### 2.5 Databases

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| MySQL/MariaDB + PG | **Have** | — | — |
| Users, import/export, remote IP | **Have** | — | — |
| Root password manager | **Have** | Encrypted in `panel_settings` | — |
| Repair / optimize / engine | **Have** | Tools API | — |
| Recycle bin | **Have** | Soft delete + purge | — |
| MongoDB / Redis | **Have** (Phase D) | `mongosh` / `redis-cli` when installed | — |
| phpMyAdmin / phpPgAdmin | **Have** embeds | — | — |

**Mapping:** `Databases`, `/v1/databases*`, `DatabasesPage.tsx`, Embed.

### 2.6 Docker

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Containers run/stop/logs/images | Have | — | — |
| Optional nginx proxy | Have | — | — |
| Compose stacks + yaml/.env | **Have** | — | 4 |
| Networks / volumes / registry | **Have** | — | 4 |
| Daemon settings / mirror | **Have** (mirrors + log-opts) | full daemon UI later | 4 |
| One-click apps | **Have** Softstore docker seeds | more templates later | 3–4 |
| Container terminal | **Have** (Phase D) | — | — |

**Mapping:** `Apps`, `/v1/docker/*`, `AppsPage.tsx`, `handlers_docker.go`, `handlers_docker_depth.go`.

### 2.7 Monitor + Logs

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Services start/stop | **Have** | — | — |
| Log tail + grouped sources | **Have** (Phase D) | `groups`: panel / site / ftp | — |
| Uptime HTTP/TCP | **Have** | — | — |
| Channels Telegram/Slack/… | **Have** | Cron failure + quota breach wired | — |
| Time-series CPU/RAM/disk/net | **Have** (+ disk IO) | — | 5 |
| Process manager | **Have** TOP/kill | — | 5 |

**Mapping:** Monitoring, Metrics, `/v1/services`, `/v1/logs`, `/v1/system/processes`.

### 2.8 Security + WAF (Pro-class)

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Firewall UFW | Have | — | — |
| Fail2ban + filters | Have | — | — |
| SSH keys | Have | — | — |
| ClamAV history/schedule | Have | Auto-quarantine → recycle | 6–7 |
| Audit log | Have | — | — |
| Risk scanner + one-click fix | **Have** | — | 6 |
| Website vuln scan | **Have** (weak-path checks) | — | 6 |
| System hardening checklist | **Have** (risks UI) | — | 6 |
| WAF ModSecurity baseline | **Have** (global + per-site + logs + geo deny) | Heavy site vuln scan later | — |
| File monitor / tamper | **Have** | — | 6 |

**Mapping:** Security module, `handlers_security.go`, security pages.

### 2.9 Mail

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Domains, accounts, forwarders, auth, queue, antispam, catchall | **Have** | Bulk marketing send low priority | — |
| Webmail Roundcube | Have | — | — |
| Bulk marketing send | Low priority | Optional later | — |

**Mapping:** Email module, `/v1/mail/*`.

### 2.10 Files

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Browse/upload/download/edit | **Have** (jailed) | — | — |
| Compress/decompress | **Have** | — | — |
| Content search | **Have** | Agent ripgrep-style | — |
| Share links | **Have** | Tokenized download | — |
| Recycle bin | **Have** | Soft delete store | — |
| Remote download (URL) | **Have** | Agent fetch | — |
| File history / versions | **Have** | Up to 10 snapshots | — |

**Mapping:** Files module, `/v1/files`, `FilesPage.tsx`.

### 2.11 DNS provider APIs

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Local pdns zones/records | **Have** | DNSSEC/slaves/templates | — |
| External DNS APIs (CF, AliDNS) | **Have** (Phase D) | — | — |

**Mapping:** Dns, Ssl, `handlers_dns.go`, `handlers_ssl.go`.

### 2.12 Cron

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Per-user shell crontab | **Have** | — | — |
| Typed tasks (backup site/DB, URL, log cut) | **Have** | Allowlisted scripts | — |
| Failure notify | **Have** | `panel:check-cron-failures` → channels | — |
| Script library | **Have** | `config/cron_scripts.php` | — |

**Mapping:** Cron module, `/v1/cron`, `CronPage.tsx`.

### 2.13 App Store → Softstore

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Catalog + categories | **Have** (seeded) | Compose one-click | 3, 4 |
| Async install/upgrade jobs | **Have** | upgrade UX | 3 |
| Runtimes (Redis, Memcached, Composer) | **Have** install | — | 3 |
| Node/Python/Go via Runtimes module | **Have** | Java via Softstore `java-distro` (Phase D) | — |
| CMS one-clicks | **Have** (WordPress Softstore) | — | 3 |
| Pin to Home | **Have** | richer task box Wave 5 | 3, 5 |

**Mapping:** `Modules/Softstore/`, `InstallSoftstorePackageJob`, agent `/v1/softstore/*`, `/softstore` UI.

### 2.14 Settings

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Profile / 2FA / tokens | **Have** | — | — |
| Setup wizard | **Have** (shell prints URL+creds → `/login` → `/setup/stack` software + terminal log) | — | — |
| Panel port / SSL / bind domain | **Have** | `/settings` hub + agent Caddy write | — |
| Restart panel / OS | **Have** | Agent privileged actions | — |
| Repair panel | **Have** | Health repair scripts | — |
| IP allowlist | **Have** | Settings UI + middleware | — |

**Mapping:** Core, System, `ProfileSettingsPage`, `SystemInfoPage`.

### 2.15 Account (shared hosting)

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Plans + accounts + quota + suspend | **Have** | Quota alerts + usage bars (Phase D polish) | — |
| Reseller tree / branding | N/A won't-fix | — | — |

**Mapping:** Hosting, Users.

---

## 3. Planned navigation additions

IA stays driven by [`NavigationController.php`](backend/Modules/Core/Http/Controllers/NavigationController.php). aaPanel menu is **not** cloned 1:1; add missing capability entry points:

| Planned slug | Planned path | Section (suggested) | Purpose | Wave |
|--------------|--------------|---------------------|---------|------|
| `websites` | `/websites` | account | Unified Website hub | 1 (done) |
| `softstore` | `/softstore` | webserver | App Store / Soft Store | 3 (done) |
| `runtimes` | `/runtimes` | webserver | Node/Python/Go/Java projects | 9 (done) |
| `security-risks` | `/security/risks` | security | Risk scanner overview | 6 |
| `security-tamper` | `/security/tamper` | security | File monitor / tamper | 6 |
| `system-disk` | `/system/disk` | system | Disk analysis / cleanup | 6 |
| `settings` | `/settings` | automation or system | Panel Settings hub (port/SSL/restart) | 12 (done) |

Existing items that absorb depth (no new nav required initially): `/`, `/apps`, `/webserver/vhosts`, `/wordpress`, `/files`, `/cron`, `/dns`, `/ftp`, `/databases`, `/monitoring/*`, `/security/waf`, `/hosting/*`.

---

## 4. Implementation waves (future)

Each wave: Laravel API → Go agent → Next UI → PHPUnit / `go test` → `panel/docs/docs/` → update this matrix + TODO §9.3.

| Wave | Name | Deliverables | Depends on |
|------|------|--------------|------------|
| **0** | SSOT docs | This file + PROJECT_STATUS + TODO sync | — |
| **1** | Website hub | Unified site API/UI; create+FTP/DB; rewrite; traffic/deny; site logs; Composer hook | **Done** |
| **2** | Webserver dual-stack | **Done** — Apache templates (+ optional HTTP/3 nginx); per-vhost engine | Wave 1 |
| **3** | Soft Store | **Done** — Catalog, async installer, Home pins, runtime packages | Core queue/worker |
| **4** | Docker depth | **Done** — Compose, network, volume, registry, daemon; Softstore one-click | Apps + Wave 3 |
| **5** | Home + Monitor Pro | **Done** — TOP5, NIC/Disk IO, risk widget, task box, process view, richer series | Metrics/Monitoring/Security |
| **6** | Security Pro | **Done** — Risk scanner+fix, deep WAF, tamper, disk analysis, site analytics start | Security + System |
| **7** | Files advanced | **Done** — Search, share, recycle, remote-dl, versions | Files |
| **8** | WP Toolkit | **Done** — Clone/migrate/staging, themes/plugins, integrity | Wordpress |
| **9** | Runtimes | **Done** — Node/Python/Go/Java + PM2-like projects | Runtimes |
| **10** | Data plane | **Done** — FTP quota/enable; DB tools+recycle+Mongo/Redis; Cloudflare+AliDNS; Cron typed tasks | Ftp/Databases/Dns/Cron |
| **11** | Mail + Backup polish | **Done** — Mailing list member UX; backup verify/retention/restore wizard | Email/Backup |
| **12** | Panel Settings | **Done** — `/settings` hub, port/SSL/bind, restart/reboot/repair | Core/System |

**Done criteria per wave:** matrix rows for that wave → **Have**; module guide in `panel/docs/docs/`; TODO §9.3 updated.

**Phase D polish (post Wave 12):** closed remaining **Partial** rows — grouped log sources (panel/site/FTP), FTP password + service info, MongoDB/Redis engines, AliDNS provider, container terminal attach, Java runtime via Softstore, WAF geo-deny, cron PATCH, metric alert severity, ClamAV auto-quarantine to Files recycle. Waves **0–12 remain Done**; mandatory aaPanel C parity is **Have** except documented **N/A** items.

**Phase E — UI depth (Webino nav fixed):** deepen page widgets/actions without reordering [`NavigationController`](backend/Modules/Core/Http/Controllers/NavigationController.php). Delivered: `/monitoring/logs` route wiring; Home KPI deep-links + IO sparklines; Website hub editable php/proxy + htpasswd list/remove + log filter/download + analytics range/charts + Composer Softstore link; Softstore category tabs + upgrade/uninstall; Apps daemon (`insecure-registries`, `data-root`, `log-driver`, `live-restore`); Logs filter/highlight/export; WAF geo-deny UI; ClamAV → Files recycle link; Risks rescan; WP per-item theme/plugin actions; Redis/Mongo info tools; Settings version + firewall deep-link.

### Wave execution rules

- Host ops only via agent; list from panel DB + reconcile unless live pattern (Files/System).
- Mutations: `RequireRouteWrite` + Spatie permissions.
- No aaPanel UI/brand copy; no aaPanel commercial APIs.
- Minimal tests: module PHPUnit + new/changed Go handlers.

---

## 5. Agent endpoint inventory (anchor)

Existing routes registered in `agent/main.go` (extend rather than replace):

- Domains / DNS / SSL / FTP / PHP / mail / subdomains / files / cron / backups / git / wordpress  
- Security: firewall, fail2ban(+filters), sshkeys, clamav, waf (+sites/logs), risks, tamper  
- System: info, disk, processes  
- Websites: composer, analytics  
- Vhosts, hosting provision/suspend/usage  
- Databases (+ users, remote-access)  
- Docker containers/images  
- Services, logs, system/info, webina/sites  

**Expected new families by wave:** Softstore install tasks; Apache vhost write; compose/network/volume; process/IO metrics; risk scan; disk analysis; file monitor; runtimes; DNS provider adapters; panel control (restart/repair).

---

## 6. Document maintenance

- Update this file in the same PR as each parity wave.
- Keep [`PROJECT_STATUS.md`](PROJECT_STATUS.md) module gaps aligned.
- Keep [`WebinoDocs/TODO.md`](../../WebinoDocs/TODO.md) §9.3 wave checklist aligned; run `WebinoDocs/site/scripts/sync-content.sh` after TODO edits.
