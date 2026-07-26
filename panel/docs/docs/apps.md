# Apps (Docker depth)

Container and Compose management via the Go agent (`docker` / `docker compose`). Softstore one-click Docker packages create fixed compose projects.

## Capabilities

| Area | API | Agent |
|------|-----|-------|
| Containers | `/api/v1/apps` | `/v1/docker/containers` |
| Images | `/api/v1/apps/images` | `/v1/docker/images` |
| Compose | `/api/v1/apps/compose` | `/v1/docker/compose` |
| Networks | `/api/v1/apps/networks` | `/v1/docker/networks` |
| Volumes | `/api/v1/apps/volumes` | `/v1/docker/volumes` |
| Registry | `/api/v1/apps/registries` | `/v1/docker/registry` |
| Daemon | `/api/v1/apps/daemon` | `/v1/docker/daemon` (`registry-mirrors`, `log-opts` only) |

## Env (agent)

- `WEBINO_DOCKER_VOL_BASE` — bind-mount jail (default `/var/www`)
- `WEBINO_DOCKER_COMPOSE_ROOT` — compose project dirs (default `/var/lib/webino/compose`)
- `WEBINO_DOCKER_DAEMON_JSON` — daemon.json path

## Softstore Docker

Seeded packages `docker-redis`, `docker-nginx` (`category=docker`) run allowlisted compose templates and upsert `docker_compose_projects`.

## UI

`/apps` — tabs: Containers, Compose, Networks, Volumes, Registry, Daemon.

## Permission

Mutations require `apps.manage`.
