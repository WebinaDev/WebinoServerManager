# Webserver (dual-stack)

Nginx and Apache virtual hosts for traditional hosting sites. Primary platform domains remain on Caddy/Webina; this module targets conf under agent-managed site dirs.

## Engines

| Engine | Conf dirs (defaults) | Reload |
|--------|----------------------|--------|
| `nginx` (default) | `WEBINO_NGINX_SITES` / enabled | `nginx -t` + reload |
| `apache` | `WEBINO_APACHE_SITES` (`/etc/apache2/sites-available`), `WEBINO_APACHE_ENABLED` | `apache2ctl configtest` + reload |

Per-vhost / website field: `engine` = `nginx` | `apache`. Table name `nginx_vhosts` is unchanged.

## HTTP/3

Boolean `http3` applies **only** when `engine=nginx`. Agent adds `listen 443 quic reuseport;` (plus existing HTTP/2). Requires a nginx build with QUIC on the host; failed `nginx -t` returns an error. Apache ignores `http3`.

## SSL

Certbot uses `--nginx` or `--apache` based on `engine`.

## API / UI

- Websites hub and `/webserver/vhosts` accept `engine` and `http3` on create (and website update).
- Suspend/unsuspend hosting toggles both nginx and Apache enable dirs when conf exists.

## Agent

- `POST /v1/vhosts` — `engine`, `http3`; Apache via `buildApacheVhost`
- Env: `WEBINO_APACHE_SITES`, `WEBINO_APACHE_ENABLED`
