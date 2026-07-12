#!/usr/bin/env bash
# Docker Hub connectivity, registry mirror setup, and image pre-pull helpers.

WEBINA_DOCKER_DEFAULT_MIRROR="${WEBINA_DOCKER_DEFAULT_MIRROR:-https://mirror.gcr.io}"
DOCKER_DAEMON_JSON="/etc/docker/daemon.json"

docker_registry_test_hub() {
  local code
  code=$(curl -sI -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 15 \
    https://registry-1.docker.io/v2/ 2>/dev/null) || code="000"
  case "$code" in
    401|200) return 0 ;;
    403) return 2 ;;
    *) return 1 ;;
  esac
}

docker_registry_pull_hints() {
  cat <<'EOF'

Docker image pull failed — common fixes:
  1. Re-run panel install (auto-configures mirror.gcr.io on failure):
       ./install.sh --panel
  2. Manual registry mirror:
       WEBINA_DOCKER_REGISTRY_MIRROR=https://mirror.gcr.io ./install.sh --panel
  3. Disable auto-mirror and use VPN, then:
       WEBINA_DOCKER_SKIP_MIRROR_AUTO=1 ./install.sh --panel
  4. Pre-pull manually after mirror setup:
       docker pull mariadb:11 && docker pull redis:7-alpine

See docs/TROUBLESHOOTING.md — Docker Hub / image pull
EOF
}

docker_registry_restart_docker() {
  if have systemctl; then
    systemctl restart docker 2>/dev/null || return 1
  elif have service; then
    service docker restart 2>/dev/null || return 1
  else
    return 1
  fi
  sleep 3
  docker info >/dev/null 2>&1
}

docker_registry_docker_has_containers() {
  have docker || return 1
  docker info >/dev/null 2>&1 || return 1
  [[ -n "$(docker ps -aq 2>/dev/null | head -1)" ]]
}

docker_registry_ensure_mirror() {
  local mirror="${WEBINA_DOCKER_REGISTRY_MIRROR:-$WEBINA_DOCKER_DEFAULT_MIRROR}"
  local allow_snap_disable=0
  [[ "${WEBINA_DOCKER_SKIP_MIRROR_AUTO:-0}" == "1" ]] && return 1
  [[ -n "$mirror" ]] || return 1

  have python3 || { warn "python3 required to configure Docker registry mirror"; return 1; }

  if [[ ! -w "$DOCKER_DAEMON_JSON" && "${EUID:-$(id -u)}" -ne 0 ]]; then
    warn "Cannot write ${DOCKER_DAEMON_JSON} — run as root to auto-configure mirror"
    return 1
  fi

  if docker_registry_docker_has_containers; then
    warn "Skipping containerd-snapshotter change — Docker already has containers/images"
    warn "If referrers/403 persist, configure mirror manually or stop containers before re-run"
  else
    allow_snap_disable=1
  fi

  log "Configuring Docker registry mirror: ${mirror}"

  if [[ -f "$DOCKER_DAEMON_JSON" ]]; then
    cp -a "$DOCKER_DAEMON_JSON" "${DOCKER_DAEMON_JSON}.webina.bak.$(date +%s)" 2>/dev/null || true
  fi

  python3 - "$DOCKER_DAEMON_JSON" "$mirror" "$allow_snap_disable" <<'PY'
import json, os, sys
path, mirror, allow_snap = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
data = {}
if os.path.isfile(path):
    with open(path, encoding="utf-8") as f:
        try:
            data = json.load(f) or {}
        except json.JSONDecodeError:
            data = {}
mirrors = data.get("registry-mirrors") or []
if mirror not in mirrors:
    mirrors.append(mirror)
data["registry-mirrors"] = mirrors
if allow_snap:
    features = data.get("features")
    if not isinstance(features, dict):
        features = {}
    if features.get("containerd-snapshotter") is not False:
        features["containerd-snapshotter"] = False
        data["features"] = features
os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

  docker_registry_restart_docker || warn "Docker restart failed after mirror config"
}

docker_registry_pull_image() {
  local image="$1"
  [[ -n "$image" ]] || return 0

  export BUILDKIT_NO_CLIENT_TOKEN="${BUILDKIT_NO_CLIENT_TOKEN:-1}"
  export BUILDX_NO_DEFAULT_ATTESTATIONS="${BUILDX_NO_DEFAULT_ATTESTATIONS:-1}"

  log "Pulling ${image}..."
  if docker pull "$image"; then
    return 0
  fi
  return 1
}

docker_registry_pull_images() {
  local image failed=0
  [[ $# -gt 0 ]] || return 0

  export BUILDKIT_NO_CLIENT_TOKEN="${BUILDKIT_NO_CLIENT_TOKEN:-1}"
  export BUILDX_NO_DEFAULT_ATTESTATIONS="${BUILDX_NO_DEFAULT_ATTESTATIONS:-1}"

  for image in "$@"; do
    if docker_registry_pull_image "$image"; then
      continue
    fi
    failed=1
    break
  done

  if [[ "$failed" -eq 0 ]]; then
    return 0
  fi

  if [[ "${WEBINA_DOCKER_SKIP_MIRROR_AUTO:-0}" == "1" ]]; then
    docker_registry_pull_hints >&2
    return 1
  fi

  warn "Image pull failed — attempting registry mirror setup..."
  if ! docker_registry_ensure_mirror; then
    docker_registry_pull_hints >&2
    return 1
  fi

  failed=0
  for image in "$@"; do
    docker_registry_pull_image "$image" || failed=1
  done

  if [[ "$failed" -ne 0 ]]; then
    docker_registry_pull_hints >&2
    return 1
  fi

  log "Images pulled successfully via registry mirror."
  return 0
}

panel_compose_image_list() {
  local env_file="${1:-}"
  printf '%s\n' \
    "$(read_env "$env_file" "PANEL_MARIADB_IMAGE" "mariadb:11")" \
    "$(read_env "$env_file" "PANEL_REDIS_IMAGE" "redis:7-alpine")" \
    "$(read_env "$env_file" "PANEL_PHPMYADMIN_IMAGE" "phpmyadmin:5-apache")" \
    "$(read_env "$env_file" "PANEL_PHPPGADMIN_IMAGE" "dockage/phppgadmin:latest")" \
    "$(read_env "$env_file" "PANEL_ROUNDCUBE_IMAGE" "roundcube/roundcubemail:1.6.9-apache")"
}

panel_compose_prepull() {
  local env_file="${1:-}" image
  local -a images=()
  while IFS= read -r image; do
    [[ -n "$image" ]] && images+=("$image")
  done < <(panel_compose_image_list "$env_file")

  log "Pre-pulling panel stack images (${#images[@]})..."
  docker_registry_pull_images "${images[@]}"
}

panel_build_image_list() {
  printf '%s\n' \
    "php:8.3-cli-bookworm" \
    "composer:2" \
    "dunglas/frankenphp:1-php8.3-bookworm" \
    "node:22-alpine" \
    "golang:1.22-bookworm" \
    "debian:bookworm-slim"
}

panel_build_prepull() {
  local image
  local -a images=()
  while IFS= read -r image; do
    [[ -n "$image" ]] && images+=("$image")
  done < <(panel_build_image_list)

  log "Pre-pulling panel build base images (${#images[@]})..."
  docker_registry_pull_images "${images[@]}" || warn "Panel build base image pre-pull had issues — build may retry pulls"
}

platform_compose_image_list() {
  printf '%s\n' \
    "${PLATFORM_REDIS_IMAGE:-redis:7-alpine}" \
    "${PLATFORM_CADDY_IMAGE:-caddy:2-alpine}"
}

platform_compose_prepull() {
  local image
  local -a images=()
  while IFS= read -r image; do
    [[ -n "$image" ]] && images+=("$image")
  done < <(platform_compose_image_list)

  log "Pre-pulling platform stack images (${#images[@]})..."
  docker_registry_pull_images "${images[@]}"
}
