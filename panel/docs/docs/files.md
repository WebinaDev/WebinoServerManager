---
sidebar_position: 18
---

# Files (advanced)

Jail-root file manager under `WEBINO_FILES_ROOT` (default `/var/www`). Deletes soft-move into `.webino-recycle`. Writes keep up to 10 versions under `.webino-versions`.

Permission: `system.manage` (except public share download).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/files` | List |
| `POST` | `/api/v1/files/search` | `{ query, path?, max_depth?, max_hits? }` |
| `POST` | `/api/v1/files/remote-download` | `{ path, url }` http(s) only, 50MB cap |
| `GET` | `/api/v1/files/recycle` | Recycle list |
| `POST` | `/api/v1/files/recycle/restore` | `{ id }` |
| `POST` | `/api/v1/files/recycle/purge` | `{ id }` |
| `POST` | `/api/v1/files/versions` | `{ path }` |
| `POST` | `/api/v1/files/versions/restore` | `{ path, version }` |
| `GET/POST` | `/api/v1/files/shares` | Timed share tokens |
| `GET` | `/api/v1/files/share/{token}` | Public download (no session) |

Agent actions: `search`, `recycle*`, `remote_download`, `versions`, `restore_version`; `delete` → recycle; `write` → version snapshot.
