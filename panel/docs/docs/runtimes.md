# Runtimes

Node.js, Python, and Go runtime installers plus PM2-like project management. Paths are jailed under `WEBINO_FILES_ROOT`; process state uses pid/log files in `.webino/runtimes/`.

## Tables

- `runtimes_versions` — seeded install catalog (nvm, NodeSource, distro Python/Go)
- `runtimes_projects` — panel-managed projects (name, runtime, work_dir, entry/npm script)

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/runtimes/versions` | auth (+ host probe) |
| POST | `/api/v1/runtimes/versions/{id}/install` | `system.manage` |
| GET | `/api/v1/runtimes/projects` | auth |
| POST | `/api/v1/runtimes/projects` | `system.manage` |
| POST | `/api/v1/runtimes/projects/{id}/start` | `system.manage` |
| POST | `/api/v1/runtimes/projects/{id}/stop` | `system.manage` |
| POST | `/api/v1/runtimes/projects/{id}/restart` | `system.manage` |
| GET | `/api/v1/runtimes/projects/{id}/logs` | auth |
| DELETE | `/api/v1/runtimes/projects/{id}` | `system.manage` |

## Agent

| Route | Purpose |
|-------|---------|
| `GET /v1/runtimes/status` | Probe node/python/go in PATH |
| `POST /v1/runtimes/install` | Allowlisted `{script_id}` installs |
| `POST /v1/runtimes/projects` | `start` / `stop` / `restart` / `logs` / `status` |

Allowlisted install scripts: `install_node_nvm`, `install_node_nodesource`, `install_python_distro`, `install_go_distro`.

Start argv is built from runtime + entry script or npm script name (no free-form shell).

## Soft Store cross-link

Optional Soft Store seeds (`category=runtime`): `node-nvm`, `python-distro` — same agent scripts via `/v1/softstore/install`.

## UI

- `/runtimes` — install runtimes, create projects, start/stop/restart, view logs

## Java

Not implemented in Wave 9 — parity matrix marks Java as **Partial** (Node + Python + Go covered).
