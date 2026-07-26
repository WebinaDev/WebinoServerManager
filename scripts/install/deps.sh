#!/usr/bin/env bash
# System dependency detection and optional auto-install for server bootstrap.

WEBINO_INSTALL_DOCKER="${WEBINO_INSTALL_DOCKER:-}"
WEBINO_DOCKER_CE="${WEBINO_DOCKER_CE:-0}"
WEBINO_SKIP_DEPS="${WEBINO_SKIP_DEPS:-0}"
WEBINO_COMPOSE_VERSION="${WEBINO_COMPOSE_VERSION:-v2.32.4}"
_DEPS_APT_UPDATED=0

# Shared fix text for Docker/Compose install failures (avoid pointing only at get.docker.com).
deps_docker_fix_hint() {
  cat <<'EOF'
  Fix: apt-get install -y docker.io docker-compose-v2 && systemctl enable --now docker
  Fix (Compose binary): see docs/TROUBLESHOOTING.md — GitHub docker-compose plugin
  Optional Docker CE (needs download.docker.com): WEBINO_DOCKER_CE=1 ./install.sh --server --yes
EOF
}

deps_pkg_manager() {
  if have apt-get; then echo apt
  elif have dnf; then echo dnf
  elif have yum; then echo yum
  elif have pacman; then echo pacman
  else echo unknown
  fi
}

deps_apt_update_once() {
  [[ "$_DEPS_APT_UPDATED" == "1" ]] && return 0
  if ! apt-get update -qq; then
    warn "apt-get update failed — will retry after cleaning broken Docker apt sources if needed"
    return 1
  fi
  _DEPS_APT_UPDATED=1
  return 0
}

# Disable leftover Docker Inc. apt lists that 403 on many networks (e.g. download.docker.com).
deps_cleanup_broken_docker_apt() {
  local pm f changed=0
  pm=$(deps_pkg_manager)
  [[ "$pm" == apt ]] || return 0

  shopt -s nullglob
  for f in /etc/apt/sources.list.d/*docker* /etc/apt/sources.list.d/*Docker*; do
    [[ -f "$f" ]] || continue
    if grep -qE 'download\.docker\.com|download\.docker\.com/linux' "$f" 2>/dev/null; then
      log "Disabling broken Docker apt source: $f"
      mv -f "$f" "${f}.webina-disabled" 2>/dev/null || rm -f "$f"
      changed=1
    fi
  done
  shopt -u nullglob

  if [[ "$changed" == "1" ]]; then
    _DEPS_APT_UPDATED=0
    apt-get update -qq || warn "apt-get update still failing after Docker apt cleanup"
    _DEPS_APT_UPDATED=1
  fi
}

deps_install_docker_via_distro() {
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1
  local pm
  pm=$(deps_pkg_manager)

  log "Installing Docker from distro packages (docker.io)..."
  case "$pm" in
    apt)
      deps_cleanup_broken_docker_apt
      _DEPS_APT_UPDATED=0
      deps_apt_update_once || {
        deps_cleanup_broken_docker_apt
        _DEPS_APT_UPDATED=0
        deps_apt_update_once || return 1
      }
      if ! apt-get install -y docker.io; then
        warn "apt install docker.io failed"
        return 1
      fi
      ;;
    dnf|yum)
      if ! deps_install_pkg docker; then
        deps_install_pkg docker-ce || return 1
      fi
      ;;
    pacman)
      deps_install_pkg docker || return 1
      ;;
    *)
      warn "Unknown package manager — cannot install Docker via distro packages"
      return 1
      ;;
  esac

  have docker || return 1
  deps_start_docker
  return 0
}

deps_install_docker_via_getdocker() {
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1
  have curl || return 1

  log "Installing Docker CE via get.docker.com..."
  if ! curl -fsSL https://get.docker.com | sh; then
    warn "get.docker.com install failed (often 403 on download.docker.com)"
    deps_cleanup_broken_docker_apt
    return 1
  fi
  if ! have docker; then
    warn "get.docker.com finished but docker binary still missing"
    deps_cleanup_broken_docker_apt
    return 1
  fi
  deps_start_docker
  return 0
}

deps_install_pkg() {
  local pkg="$1"
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1
  local pm
  pm=$(deps_pkg_manager)
  case "$pm" in
    apt)
      deps_apt_update_once
      apt-get install -y "$pkg"
      ;;
    dnf) dnf install -y "$pkg" ;;
    yum) yum install -y "$pkg" ;;
    pacman) pacman -Sy --noconfirm "$pkg" ;;
    *) return 1 ;;
  esac
}

deps_install_batch() {
  local -a pkgs=("$@")
  [[ ${#pkgs[@]} -eq 0 ]] && return 0
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1

  local pm
  pm=$(deps_pkg_manager)
  log "Installing packages: ${pkgs[*]}..."
  case "$pm" in
    apt)
      deps_apt_update_once
      apt-get install -y "${pkgs[@]}"
      ;;
    dnf) dnf install -y "${pkgs[@]}" ;;
    yum) yum install -y "${pkgs[@]}" ;;
    pacman) pacman -Sy --noconfirm "${pkgs[@]}" ;;
    *) return 1 ;;
  esac
}

deps_have_compose() {
  webina_compose_available
}

deps_start_docker() {
  if have systemctl; then
    systemctl enable --now docker 2>/dev/null || true
  elif have service; then
    service docker start 2>/dev/null || true
  fi
}

deps_ensure_docker_running() {
  have docker || return 1
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  warn "Docker installed but daemon not running — attempting to start..."
  deps_start_docker
  sleep 2
  docker info >/dev/null 2>&1
}

deps_warn_docker_group() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    return 0
  fi
  if groups 2>/dev/null | grep -qw docker; then
    return 0
  fi
  warn "Current user is not in the docker group."
  warn "Fix: sudo usermod -aG docker \$USER && newgrp docker"
}

deps_install_compose_plugin_binary() {
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1
  have curl || return 1
  have docker || return 1

  local arch plugin_dir url
  arch=$(uname -m)
  case "$arch" in
    x86_64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    armv7l|armv6l) arch="armv7" ;;
    *) warn "Unsupported architecture for Compose plugin binary: $arch"
       return 1 ;;
  esac

  plugin_dir="/usr/local/lib/docker/cli-plugins"
  url="https://github.com/docker/compose/releases/download/${WEBINO_COMPOSE_VERSION}/docker-compose-linux-${arch}"

  log "Installing Docker Compose v2 plugin binary (${WEBINO_COMPOSE_VERSION})..."
  mkdir -p "$plugin_dir"
  if ! curl -fSL "$url" -o "${plugin_dir}/docker-compose"; then
    warn "Compose plugin binary download failed: $url"
    return 1
  fi
  chmod +x "${plugin_dir}/docker-compose"
  webina_compose_v2_works
}

deps_install_compose_via_apt() {
  local pm
  pm=$(deps_pkg_manager)
  [[ "$pm" == apt ]] || return 1
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1

  deps_apt_update_once || {
    deps_cleanup_broken_docker_apt
    _DEPS_APT_UPDATED=0
    deps_apt_update_once || return 1
  }
  # Prefer distro compose (docker-compose-v2) over Docker Inc. plugin (needs download.docker.com).
  local -a pkgs=(docker-compose-v2 docker-compose-plugin docker-compose)
  local pkg
  for pkg in "${pkgs[@]}"; do
    log "Trying apt package: ${pkg}..."
    if apt-get install -y "$pkg"; then
      if webina_compose_verify; then
        return 0
      fi
      warn "Package ${pkg} installed but docker compose still not working"
    else
      warn "apt install ${pkg} failed"
    fi
  done
  return 1
}

deps_install_compose_via_getdocker() {
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1
  log "Installing Docker CE stack via get.docker.com (includes Compose v2 plugin)..."
  if ! curl -fsSL https://get.docker.com | sh; then
    warn "get.docker.com install failed"
    return 1
  fi
  deps_start_docker
  webina_compose_verify
}

deps_install_compose() {
  webina_compose_verify && return 0
  have docker || return 1
  [[ "$WEBINO_SKIP_DEPS" == "1" ]] && return 1

  log "Docker Compose missing or broken — installing..."
  deps_ensure_docker_running || warn "Docker daemon not running yet — continuing compose install"

  local pm
  pm=$(deps_pkg_manager)
  case "$pm" in
    apt)
      # Prefer Ubuntu/Debian compose packages (docker-compose-v2) before Docker Inc. plugin.
      deps_cleanup_broken_docker_apt
      _DEPS_APT_UPDATED=0
      deps_install_compose_via_apt || true
      ;;
    dnf|yum)
      if deps_install_pkg docker-compose-plugin && webina_compose_verify; then
        return 0
      fi
      deps_install_pkg docker-compose && webina_compose_verify
      ;;
    pacman)
      deps_install_pkg docker-compose && webina_compose_verify
      ;;
  esac

  if ! webina_compose_verify; then
    deps_install_compose_plugin_binary || true
  fi

  # Last resort only when CE is explicitly requested (download.docker.com often 403).
  if ! webina_compose_verify && [[ "${WEBINO_DOCKER_CE:-0}" == "1" ]]; then
    deps_install_compose_via_getdocker || true
  fi

  if ! webina_compose_verify; then
    webina_compose_diagnose
    return 1
  fi
  return 0
}

deps_install_docker() {
  local install_docker="${WEBINO_INSTALL_DOCKER:-1}"
  local prefer_ce="${WEBINO_DOCKER_CE:-0}"

  if ! have docker; then
    if [[ "$install_docker" == "0" ]]; then
      warn "WEBINO_INSTALL_DOCKER=0 — skipping Docker auto-install"
      have docker || return 1
    elif [[ "$prefer_ce" == "1" ]]; then
      deps_install_docker_via_getdocker || deps_install_docker_via_distro || true
    else
      # Default: distro packages first (works when download.docker.com is blocked).
      if ! deps_install_docker_via_distro; then
        warn "Distro Docker install failed — trying get.docker.com as fallback..."
        deps_install_docker_via_getdocker || true
        if ! have docker; then
          deps_cleanup_broken_docker_apt
          deps_install_docker_via_distro || true
        fi
      fi
    fi
    deps_start_docker
  fi

  have docker || return 1

  deps_ensure_docker_running || warn "Docker daemon not running yet — will retry after compose install"

  if ! webina_compose_verify; then
    deps_install_compose || return 1
  fi

  if ! webina_compose_verify; then
    warn "Docker Compose command check failed"
    webina_compose_diagnose
    return 1
  fi

  deps_ensure_docker_running || return 1
  return 0
}

ensure_system_deps() {
  log "Checking system dependencies for server platform..."

  local -a missing=()
  have git || missing+=(git)
  have python3 || missing+=(python3)
  if ! have envsubst; then
    missing+=("$(deps_gettext_pkg)")
  fi
  have dialog || missing+=(dialog)

  if [[ ${#missing[@]} -gt 0 ]]; then
    deps_install_batch "${missing[@]}" || warn "Package install batch failed — re-checking..."
    local -a still_missing=()
    have git || still_missing+=(git)
    have python3 || still_missing+=(python3)
    if ! have envsubst; then
      still_missing+=("$(deps_gettext_pkg)")
    fi
    have dialog || still_missing+=(dialog)
    if [[ ${#still_missing[@]} -gt 0 ]]; then
      warn "Still missing after install attempt: ${still_missing[*]}"
      warn "Fix: apt install -y ${still_missing[*]}"
    fi
  fi

  if ! deps_install_docker; then
    webina_compose_diagnose
    die "Docker + Compose are required but not installed.
$(deps_docker_fix_hint)"
  fi

  deps_ensure_docker_running || die "Docker daemon is not running.
  Fix: systemctl start docker   or   service docker start"

  webina_compose_verify || {
    webina_compose_diagnose
    die "Docker Compose is not working.
$(deps_docker_fix_hint)"
  }

  deps_warn_docker_group

  have python3 || die "python3 is required for site registry.
  Fix: apt install -y python3"

  have envsubst || die "envsubst is required for site compose generation.
  Fix: apt install -y gettext-base"

  have dialog || die "dialog is required for the control panel.
  Fix: apt install -y dialog"

  log "System dependencies OK."
}

deps_gettext_pkg() {
  local pm
  pm=$(deps_pkg_manager)
  case "$pm" in
    apt) echo gettext-base ;;
    *) echo gettext ;;
  esac
}
