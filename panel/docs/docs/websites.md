# Websites hub

Unified hosting websites (PHP/static/proxy sites on nginx or Apache), separate from Platform **Sites** (Webina product deploy).

## Capabilities

- List / create / update / delete websites (`hosting_websites` + linked `nginx_vhosts`)
- Web server `engine` (`nginx` \| `apache`) and optional `http3` (nginx only) — see [webserver.md](webserver.md)
- Orchestrated create: optional PHP pool, Let's Encrypt issue, FTP account, MySQL database
- Aliases → `server_name` / Apache `ServerAlias`
- Rewrite templates: none, WordPress, Laravel, custom
- Deny paths, hotlink protection, per-site traffic rate limit
- Directory auth (htpasswd)
- Per-site access/error logs
- Composer `install` / `update` in document root (jailed)

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/websites` | auth |
| GET | `/api/v1/websites/rewrite-templates` | auth |
| GET | `/api/v1/websites/{id}` | auth |
| POST | `/api/v1/websites` | `domains.manage` |
| PATCH / DELETE | `/api/v1/websites/{id}` | `domains.manage` |
| POST | `/api/v1/websites/{id}/htpasswd` | `domains.manage` |
| GET | `/api/v1/websites/{id}/logs` | auth |
| POST | `/api/v1/websites/{id}/composer` | `domains.manage` |

## Agent

- `POST /v1/vhosts` — extended opts (aliases, rewrite, deny, hotlink, traffic, per-site logs)
- `POST /v1/vhosts/{name}/htpasswd`
- `GET /v1/logs?source=vhost-access:{fqdn}` / `vhost-error:{fqdn}`
- `POST /v1/websites/composer`

## UI

- `/websites` — list + create dialog
- `/websites/[id]` — overview, protection, logs, composer; link to raw vhost editor

## Quota

When `hosting_account_id` is set, website count counts against plan `max_domains` (resource key `websites`).
