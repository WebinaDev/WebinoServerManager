#!/usr/bin/env bash
# Download and sync product source trees into WEBINA_PRODUCTS_DIR.

_acquire_have() { command -v "$1" >/dev/null 2>&1; }

_acquire_ensure_curl_tar() {
  _acquire_have curl && _acquire_have tar && return 0
  log "Installing curl and tar..."
  if _acquire_have apt-get; then
    apt-get update -qq && apt-get install -y curl tar
  elif _acquire_have dnf; then
    dnf install -y curl tar
  elif _acquire_have yum; then
    yum install -y yum-utils curl tar && yum install -y curl tar
  elif _acquire_have pacman; then
    pacman -Sy --noconfirm curl tar
  fi
  _acquire_have curl && _acquire_have tar
}

_acquire_ensure_git() {
  _acquire_have git && return 0
  log "Installing git..."
  if _acquire_have apt-get; then
    apt-get update -qq && apt-get install -y git
  elif _acquire_have dnf; then
    dnf install -y git
  elif _acquire_have yum; then
    yum install -y git
  elif _acquire_have pacman; then
    pacman -Sy --noconfirm git
  fi
  _acquire_have git
}

_acquire_git_http_opts=( -c http.postBuffer=524288 )

_acquire_latest_release_tag() {
  local repo_slug="$1" prerelease="$2" url
  url="${WEBINO_PACKAGE_BASE}/api/v1/repos/${repo_slug}/releases?draft=false&pre-release=${prerelease}&limit=1"
  curl -fsSL --connect-timeout 10 --max-time 30 "$url" 2>/dev/null \
    | grep -m1 '"tag_name"' \
    | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/'
}

_acquire_resolve_ref() {
  local channel="$1" repo_slug="$2"
  case "$channel" in
    Dev|dev)
      printf '%s' "$WEBINO_PRODUCT_BRANCH"
      return 0
      ;;
    LTS|lts)
      local tag
      tag=$(_acquire_latest_release_tag "$repo_slug" "false")
      if [[ -z "$tag" ]]; then
        warn "No LTS release for ${repo_slug}."
        return 1
      fi
      printf '%s' "$tag"
      return 0
      ;;
    Beta|beta)
      local tag
      tag=$(_acquire_latest_release_tag "$repo_slug" "true")
      if [[ -z "$tag" ]]; then
        warn "No Beta release for ${repo_slug}."
        return 1
      fi
      printf '%s' "$tag"
      return 0
      ;;
    *)
      warn "Unknown channel '${channel}' — using Dev."
      printf '%s' "$WEBINO_PRODUCT_BRANCH"
      return 0
      ;;
  esac
}

_acquire_remote_commit_sha() {
  local repo_slug="$1" ref="$2" sha=""
  sha=$(curl -fsSL --connect-timeout 10 --max-time 30 \
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${repo_slug}/git/refs/heads/${ref}" \
    2>/dev/null | grep -m1 '"sha"' | sed 's/.*"sha": "\([^"]*\)".*/\1/' || true)
  if [[ -n "$sha" ]]; then
    printf '%s' "$sha"
    return 0
  fi
  curl -fsSL --connect-timeout 10 --max-time 30 \
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${repo_slug}/commits?limit=1" \
    2>/dev/null | grep -m1 '"sha"' | sed 's/.*"sha": "\([^"]*\)".*/\1/' || true
}

_acquire_is_network_error() {
  local err_file="$1"
  grep -qiE 'SSL connection timeout|Connection reset|Could not resolve|Failed to connect|unable to access|Connection timed out|Network is unreachable|TLS|timeout|Operation too slow|Less than [0-9]+ bytes/sec' "$err_file" 2>/dev/null
}

_acquire_install_valid() {
  local target="$1"
  [[ -d "${target}/backend" && -d "${target}/frontend" ]]
}

_acquire_write_meta() {
  local target="$1" product="$2" channel="$3" ref="$4"
  printf '%s\n' "$product" >"${target}/.webino-product"
  printf '%s\n' "$channel" >"${target}/.webino-channel"
  printf '%s\n' "$ref" >"${target}/.webino-ref"
}

_acquire_download_tarball() {
  local product="$1" repo_slug="$2" ref="$3" target="$4"
  local url tmpdir extract_dir sha archive downloaded=0
  local -a archive_urls=(
    "${WEBINO_PACKAGE_BASE}/${repo_slug}/archive/${ref}.tar.gz"
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${repo_slug}/archive/${ref}.tar.gz"
  )

  tmpdir=$(mktemp -d)
  archive="$tmpdir/archive.tar.gz"
  log "Downloading ${product} (${ref})..."

  for url in "${archive_urls[@]}"; do
    if curl -fL \
      --connect-timeout "${WEBINO_CURL_CONNECT_TIMEOUT:-15}" \
      --max-time "${WEBINO_CURL_MAX_TIME:-120}" \
      --retry 1 --retry-delay 2 \
      -o "$archive" "$url" 2>/dev/null; then
      downloaded=1
      break
    fi
    rm -f "$archive"
  done

  if [[ "$downloaded" -ne 1 ]] || [[ ! -s "$archive" ]]; then
    rm -rf "$tmpdir"
    return 1
  fi

  if ! tar -xzf "$archive" -C "$tmpdir"; then
    rm -rf "$tmpdir"
    return 1
  fi

  extract_dir=$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -1)
  [[ -n "$extract_dir" ]] || { rm -rf "$tmpdir"; return 1; }
  rm -rf "$target"
  mkdir -p "$(dirname "$target")"
  mv "$extract_dir" "$target"
  rm -rf "$tmpdir"
  printf 'tarball\n' >"${target}/.webino-source"
  if [[ "$ref" == "$WEBINO_PRODUCT_BRANCH" ]]; then
    sha=$(_acquire_remote_commit_sha "$repo_slug" "$ref")
    [[ -n "$sha" ]] && printf '%s\n' "$sha" >"${target}/.webino-version"
  else
    printf '%s\n' "$ref" >"${target}/.webino-version"
  fi
  return 0
}

_acquire_git_clone() {
  local repo_slug="$1" ref="$2" target="$3" repo
  repo="${WEBINO_PACKAGE_BASE}/${repo_slug}.git"
  rm -rf "$target"
  if git "${_acquire_git_http_opts[@]}" clone --depth 1 --branch "$ref" "$repo" "$target" 2>/dev/null; then
    printf 'git\n' >"${target}/.webino-source"
    local sha
    sha=$(git -C "$target" rev-parse HEAD 2>/dev/null || true)
    [[ -n "$sha" ]] && printf '%s\n' "$sha" >"${target}/.webino-version"
    return 0
  fi
  rm -rf "$target"
  return 1
}

_acquire_use_local_monorepo() {
  local product="$1" target="$2" local_path channel ref
  local_path=$(product_local_monorepo_path "$product" || true)
  [[ -n "$local_path" ]] || return 1
  if [[ "${WEBINA_USE_LOCAL_PRODUCTS:-1}" == "0" ]]; then
    return 1
  fi
  log "Using local monorepo source for ${product}: ${local_path}"
  mkdir -p "$(dirname "$target")"
  if [[ "$target" -ef "$local_path" ]]; then
    : # already the local path
  elif [[ -L "$target" ]]; then
    rm -f "$target"
    ln -sfn "$local_path" "$target"
  elif [[ ! -e "$target" ]]; then
    ln -sfn "$local_path" "$target"
  else
    rsync -a --delete --exclude '.git' --exclude 'vendor' --exclude 'node_modules' --exclude '.next' \
      "${local_path}/" "${target}/" 2>/dev/null || cp -a "${local_path}/." "${target}/"
  fi
  channel="${2:-Dev}"
  ref="${WEBINO_PRODUCT_BRANCH}"
  printf 'local\n' >"${target}/.webino-source"
  _acquire_write_meta "$target" "$product" "$channel" "$ref"
  return 0
}

# acquire_product PRODUCT [CHANNEL]
# Downloads or links product source to WEBINA_PRODUCTS_DIR/{PRODUCT}.
acquire_product() {
  local product channel="${2:-Dev}" repo_slug ref target
  product="$(product_normalize "$1")" || die "Unknown product: $1"
  case "${channel,,}" in
    dev) channel="Dev" ;;
    lts) channel="LTS" ;;
    beta) channel="Beta" ;;
  esac

  repo_slug=$(product_repo_slug "$product")
  target=$(product_source_dir "$product")

  if _acquire_use_local_monorepo "$product" "$target" "$channel"; then
    log "Product ${product} ready at ${target} (local)"
    return 0
  fi

  ref=$(_acquire_resolve_ref "$channel" "$repo_slug") || die "Channel ${channel} unavailable for ${product}. Use Dev."

  if _acquire_install_valid "$target"; then
    local stored_ref=""
    [[ -f "${target}/.webino-ref" ]] && stored_ref=$(tr -d '\n' <"${target}/.webino-ref")
    if [[ "$stored_ref" == "$ref" ]]; then
      log "Product ${product} already at ${channel} (${ref})"
      _acquire_write_meta "$target" "$product" "$channel" "$ref"
      return 0
    fi
    log "Updating ${product} to ${channel} (${ref})..."
  fi

  _acquire_ensure_curl_tar || die "curl and tar required for product download"
  if _acquire_download_tarball "$product" "$repo_slug" "$ref" "$target"; then
    _acquire_write_meta "$target" "$product" "$channel" "$ref"
    log "Product ${product} acquired at ${target}"
    return 0
  fi

  warn "Archive download failed for ${product} — trying git..."
  _acquire_ensure_git || die "git required for product download fallback"
  if _acquire_git_clone "$repo_slug" "$ref" "$target"; then
    _acquire_write_meta "$target" "$product" "$channel" "$ref"
    log "Product ${product} acquired via git at ${target}"
    return 0
  fi

  die "Failed to acquire ${product} from ${WEBINO_PACKAGE_BASE}/${repo_slug}"
}

product_source_ready() {
  local product src
  product="$(product_normalize "$1")" || return 1
  src=$(product_source_dir "$product")
  _acquire_install_valid "$src"
}

product_installed_channel() {
  local product src
  product="$(product_normalize "$1")" || return 1
  src=$(product_source_dir "$product")
  [[ -f "${src}/.webino-channel" ]] && tr -d '\n' <"${src}/.webino-channel" || printf 'Dev'
}
