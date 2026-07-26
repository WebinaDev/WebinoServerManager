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
| Home | Dashboard `/` | Partial | TOP5, live NIC/Disk IO, security-risk widget, install task box, software pins | Core, Metrics, Monitoring, Security, Softstore | `/v1/system/info` (partial) → process/IO/NIC endpoints | `/` | 5 |
| Website | `/websites` hub + Domains/Subdomains/Webserver | Have (Wave 1) | Project types Node/… → Wave 9 | Websites (+ Webserver, Ftp, Databases, Php, Ssl) | `/v1/vhosts` + composer + per-site logs | `/websites`, `/websites/[id]` | 1 |
| WP Toolkit | Wordpress | Partial | Clone/migrate/staging; themes/plugins bulk; integrity; security tools | Wordpress | `/v1/wordpress` — extend | `/wordpress` | 8 |
| FTP | Ftp | Partial | Quota, enable/disable, passive/port UI, log analysis | Ftp | `/v1/ftp/accounts` — extend | `/ftp` | 10 |
| Databases | Databases + Embed | Partial | Root PW mgr, repair/optimize/engine, recycle; MongoDB/Redis | Databases | `/v1/databases*` — extend engines | `/databases`, phpMyAdmin, phpPgAdmin | 10 |
| Docker | Apps | Partial | Compose, networks, volumes, registry, daemon settings, one-click | Apps + Softstore | `/v1/docker/containers`, `/images` — extend | `/apps` (+ Softstore) | 4 |
| Monitor | Monitoring + Metrics | Partial | Rich time-series, process manager, abnormal push | Monitoring, Metrics | `/v1/services`, `/v1/logs`, system/info — extend | `/monitoring/*`, `/metrics-alerts` | 5 |
| Security | Security | Partial | Risk scanner + one-click fix, malware→recycle, vuln scan, hardening | Security | firewall, fail2ban, clamav, sshkeys, waf — extend | `/security/*` + `/security/risks` (planned) | 6 |
| WAF | Security WAF | Partial | Per-site rules, geo, webshell, deep logs (Pro-class) | Security | `/v1/security/waf` — deepen | `/security/waf` | 6 |
| Mail Server | Email + Webmail | Partial | Mailing-list UX polish; bulk marketing send low priority | Email | `/v1/mail/*` | `/email/*`, `/webmail` | 11 |
| Files | Files | Partial | Content search, share links, recycle, remote download, history | Files | `/v1/files` — extend | `/files` | 7 |
| Logs | Monitoring logs | Partial | Separate panel/site/FTP log analysis | Monitoring | `/v1/logs` — extend | `/monitoring/logs` (+ site log views) | 5 |
| Node / runtimes | — | Missing | Node versions + PM2-like projects; Python/Java/Go | **Runtimes** (new) or Apps | new `/v1/runtimes/*` | `/runtimes` (planned) | 9 |
| Domains (DNS APIs) | Dns + Ssl | Partial | Cloudflare/AliDNS/… for DNS-01 + auto site records | Dns, Ssl | `/v1/dns/*`, ssl — provider hooks | `/dns`, `/ssl` | 10 |
| Account | Hosting + Users | Partial | Shared-hosting account UX closer to aaPanel packages | Hosting, Users | hosting provision/usage | `/hosting/*`, `/users` | 10–12 |
| Terminal | Terminal | Partial | In-container terminal | Terminal, Apps | WS PTY — container attach | `/terminal` (+ apps terminal) | 4–5 |
| Cron | Cron | Partial | Typed tasks (backup/URL/log-cut), notify, script library | Cron | `/v1/cron` — extend | `/cron` | 10 |
| App Store | Softstore seeded catalog | Have (Wave 3 core) | Compose one-click → Wave 4 | **Softstore** | install allowlist + status | `/softstore` | 3 |
| Settings | Profile + System + Setup | Partial | Panel port/SSL/bind domain, restart panel/OS, repair | Core, System | system/info — panel control endpoints | `/settings` hub (planned) | 12 |
| Apache / OLS | Webserver dual-stack | Have (Wave 2; OLS out of scope) | — | Webserver | `/v1/vhosts` Apache + HTTP/3 nginx | `/webserver/vhosts`, `/websites` | 2 |
| Disk analysis | — | Missing | Analyze / clean disk (Pro-class) | System | new disk-analysis agent | `/system/disk` (planned) | 6 |
| Tamper / file monitor | — | Missing | Integrity watch + alerts | Security | new file-monitor agent | `/security/tamper` (planned) | 6 |
| Site analytics | — | Missing | Per-site traffic stats | Metrics or Webserver | log/metrics ingest | under Website hub | 5–6 |
| Load balance / multi-node | — | N/A | After Softstore; lowest priority | — | — | — | — |
| AI assistant | — | N/A | Out of mandatory parity | — | — | — | — |

---

## 2. Detail by aaPanel area

### 2.1 Home

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| OS / arch / version | System info + dashboard | Panel self-version/update/repair UI | 5, 12 |
| CPU/RAM/disk gauges | Partial via Metrics / system | Live TOP5 processes | 5 |
| NIC traffic / Disk IO | Missing or thin | Real-time charts | 5 |
| Counters sites/FTP/DB | Hosting + dashboard KPIs partial | Match aaPanel deep-links | 5 |
| Security risk widget | Audit/ClamAV exist; no risk overview | Scanner summary + fix/ignore | 5–6 |
| Software pins | **Have** Softstore pins on Home | — | 3 |
| Install task / message box | Partial (install list + active count) | richer task box Wave 5 | 3, 5 |

**Mapping:** `DashboardController`, `DashboardHome.tsx`, `handlers` system info, Metrics sample jobs.

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
| Project types Node/Python/… | Missing | Wave 9 Runtimes | 9 |
| Apache engine | **Have** | — | 2 |

**Mapping:** `DomainController`, `SubdomainController`, `Vhost*` + `handlers_vhost.go`, `handlers_ssl.go`, `handlers_php_ini.go`.

### 2.3 WP Toolkit

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Install / list / basic wp-cli | Have (Partial) | — | — |
| Themes / plugins manage | Thin | Bulk update UI | 8 |
| Clone / migrate / staging | Missing | Agent + API | 8 |
| Integrity / security tools | Missing | Checks + harden | 8 |
| Backup/restore WP | Via Backup generic | WP-aware flows | 8, 11 |

**Mapping:** `Wordpress` module, `/v1/wordpress`, `WordpressPage.tsx`.

### 2.4 FTP

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Account CRUD + jail | Have | — | — |
| Enable/disable, quota | Partial/Missing | Agent + UI | 10 |
| Passive ports / service | Missing UI | Settings + firewall note | 10 |
| FTP log analysis | Missing | Logs module | 10 |

**Mapping:** `Ftp` module, `/v1/ftp/accounts`, `FtpPage.tsx`.

### 2.5 Databases

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| MySQL/MariaDB + PG | Have | — | — |
| Users, import/export, remote IP | Have | — | — |
| Root password manager | Missing/thin | Agent + UI | 10 |
| Repair / optimize / engine | Missing | Tools API | 10 |
| Recycle bin | Missing | Soft delete + purge | 10 |
| MongoDB / Redis | Missing | Engines + Softstore install | 3, 10 |
| phpMyAdmin / phpPgAdmin | Have embeds | — | — |

**Mapping:** `Databases`, `/v1/databases*`, `DatabasesPage.tsx`, Embed.

### 2.6 Docker

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Containers run/stop/logs/images | Have | — | — |
| Optional nginx proxy | Have | — | — |
| Compose stacks + yaml/.env | Missing | Agent compose API | 4 |
| Networks / volumes / registry | Missing | Agent + UI tabs | 4 |
| Daemon settings / mirror | Missing | Agent | 4 |
| One-click apps | Missing | Softstore → Docker | 3–4 |
| Container terminal | Missing | Attach via WS | 4 |

**Mapping:** `Apps`, `/v1/docker/*`, `AppsPage.tsx`, `handlers_docker.go`.

### 2.7 Monitor + Logs

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Services start/stop | Have | — | — |
| Log tail | Have | Multi-source analysis | 5 |
| Uptime HTTP/TCP | Have | — | — |
| Channels Telegram/Slack/… | Have | Abnormal push polish | 5 |
| Time-series CPU/RAM/disk/net | Partial | Richer history + charts | 5 |
| Process manager | Missing | TOP/kill UI | 5 |

**Mapping:** Monitoring, Metrics, `/v1/services`, `/v1/logs`.

### 2.8 Security + WAF (Pro-class)

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Firewall UFW | Have | — | — |
| Fail2ban + filters | Have | — | — |
| SSH keys | Have | — | — |
| ClamAV history/schedule | Have | Auto-quarantine → recycle | 6–7 |
| Audit log | Have | — | — |
| Risk scanner + one-click fix | Missing | `panel_warning`-class checks | 6 |
| Website vuln scan | Missing | Agent scanner | 6 |
| System hardening checklist | Missing | UI + apply | 6 |
| WAF ModSecurity baseline | Partial | Per-site, geo, webshell, logs | 6 |
| File monitor / tamper | Missing | Watch + alert | 6 |

**Mapping:** Security module, `handlers_security.go`, security pages.

### 2.9 Mail

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Domains, accounts, forwarders, auth, queue, antispam, catchall | Have / Partial | Lists UX polish | 11 |
| Webmail Roundcube | Have | — | — |
| Bulk marketing send | Low priority | Optional later | — |

**Mapping:** Email module, `/v1/mail/*`.

### 2.10 Files

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Browse/upload/download/edit | Have (jailed) | — | — |
| Compress/decompress | Check depth | Fill gaps | 7 |
| Content search | Missing | Agent ripgrep-style | 7 |
| Share links | Missing | Tokenized download | 7 |
| Recycle bin | Missing | Soft delete store | 7 |
| Remote download (URL) | Missing | Agent fetch | 7 |
| File history / versions | Missing | Optional snapshots | 7 |

**Mapping:** Files module, `/v1/files`, `FilesPage.tsx`.

### 2.11 DNS provider APIs

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Local pdns zones/records | Have / Partial | DNSSEC/slaves/templates already tracked Partial | 10 |
| External DNS APIs (CF, …) | Missing | Credentials + DNS-01 hooks | 10 |

**Mapping:** Dns, Ssl, `handlers_dns.go`, `handlers_ssl.go`.

### 2.12 Cron

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Per-user shell crontab | Have | — | — |
| Typed tasks (backup site/DB, URL, log cut) | Missing | Task kinds + runner | 10 |
| Failure notify | Via channels partial | Wire cron failures | 10 |
| Script library | Missing | Templates | 10 |

**Mapping:** Cron module, `/v1/cron`, `CronPage.tsx`.

### 2.13 App Store → Softstore

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Catalog + categories | **Have** (seeded) | Compose one-click | 3, 4 |
| Async install/upgrade jobs | **Have** | upgrade UX | 3 |
| Runtimes (Redis, Memcached, Composer) | **Have** install | Node/… Wave 9 | 3, 9 |
| CMS one-clicks | Partial stub (composer in docroot) | richer CMS | 3 |
| Pin to Home | **Have** | richer task box Wave 5 | 3, 5 |

**Mapping:** `Modules/Softstore/`, `InstallSoftstorePackageJob`, agent `/v1/softstore/*`, `/softstore` UI.

### 2.14 Settings

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Profile / 2FA / tokens | Have | — | — |
| Setup wizard | Have | — | — |
| Panel port / SSL / bind domain | Partial/Missing | Panel reverse-proxy config | 12 |
| Restart panel / OS | Missing | Agent privileged actions | 12 |
| Repair panel | Missing | Health repair scripts | 12 |
| IP allowlist | Have (middleware) | Settings UI hub | 12 |

**Mapping:** Core, System, `ProfileSettingsPage`, `SystemInfoPage`.

### 2.15 Account (shared hosting)

| Capability | SM today | Gap | Wave |
|------------|----------|-----|------|
| Plans + accounts + quota + suspend | Have | UX closer to aaPanel Account | 10–12 |
| Reseller tree / branding | N/A won't-fix | — | — |

**Mapping:** Hosting, Users.

---

## 3. Planned navigation additions

IA stays driven by [`NavigationController.php`](backend/Modules/Core/Http/Controllers/NavigationController.php). aaPanel menu is **not** cloned 1:1; add missing capability entry points:

| Planned slug | Planned path | Section (suggested) | Purpose | Wave |
|--------------|--------------|---------------------|---------|------|
| `websites` | `/websites` | account | Unified Website hub | 1 (done) |
| `softstore` | `/softstore` | webserver | App Store / Soft Store | 3 (done) |
| `runtimes` | `/runtimes` | webserver or advanced | Node/Python/Java/Go projects | 9 |
| `security-risks` | `/security/risks` | security | Risk scanner overview | 6 |
| `security-tamper` | `/security/tamper` | security | File monitor / tamper | 6 |
| `system-disk` | `/system/disk` | system | Disk analysis / cleanup | 6 |
| `settings` | `/settings` | automation or system | Panel Settings hub (port/SSL/restart) | 12 |

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
| **4** | Docker depth | Compose, network, volume, registry, daemon; Softstore one-click | Apps + Wave 3 |
| **5** | Home + Monitor Pro | TOP5, NIC/Disk IO, risk widget, task box, process view, richer series | Metrics/Monitoring/Security |
| **6** | Security Pro | Risk scanner+fix, deep WAF, tamper, disk analysis, site analytics start | Security + System |
| **7** | Files advanced | Search, share, recycle, remote-dl, versions | Files |
| **8** | WP Toolkit | Clone/migrate/staging, themes/plugins, integrity | Wordpress |
| **9** | Runtimes | Node/Python/Java/Go (+ PM2-like) | Softstore or Apps |
| **10** | Data plane | FTP quota/logs; DB tools+Mongo/Redis; DNS provider APIs; Cron typed tasks | Ftp/Databases/Dns/Cron |
| **11** | Mail + Backup polish | Lists UX; backup verify/retention UX | Email/Backup |
| **12** | Panel Settings | Port/SSL/bind, restart panel/OS, repair; Settings nav hub | Core/System |

**Done criteria per wave:** matrix rows for that wave → **Have**; module guide in `panel/docs/docs/`; TODO §9.3 updated.

### Wave execution rules

- Host ops only via agent; list from panel DB + reconcile unless live pattern (Files/System).
- Mutations: `RequireRouteWrite` + Spatie permissions.
- No aaPanel UI/brand copy; no aaPanel commercial APIs.
- Minimal tests: module PHPUnit + new/changed Go handlers.

---

## 5. Agent endpoint inventory (anchor)

Existing routes registered in `agent/main.go` (extend rather than replace):

- Domains / DNS / SSL / FTP / PHP / mail / subdomains / files / cron / backups / git / wordpress  
- Security: firewall, fail2ban(+filters), sshkeys, clamav, waf  
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
