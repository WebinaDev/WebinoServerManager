#!/usr/bin/env bash
# URL builders for GitHub (default) and legacy Gitea package servers.

webino_package_init_defaults() {
  WEBINO_REPO_SLUG="${WEBINO_REPO_SLUG:-WebinaDev/WebinoServerManager}"
  WEBINO_BRANCH="${WEBINO_BRANCH:-main}"
  WEBINO_PACKAGE_BASE="${WEBINO_PACKAGE_BASE:-https://github.com}"
}

webino_package_is_gitea() {
  [[ "${WEBINO_PACKAGE_BASE}" == *"package.webina.dev"* ]] \
    || [[ "${WEBINO_PACKAGE_BACKEND:-}" == "gitea" ]]
}

webino_package_bootstrap_url() {
  local slug="${1:-$WEBINO_REPO_SLUG}" branch="${2:-$WEBINO_BRANCH}"
  if webino_package_is_gitea; then
    printf '%s/%s/raw/branch/%s/bootstrap.sh' "$WEBINO_PACKAGE_BASE" "$slug" "$branch"
  else
    printf 'https://raw.githubusercontent.com/%s/%s/bootstrap.sh' "$slug" "$branch"
  fi
}

webino_package_archive_urls() {
  local slug="$1" ref="$2"
  if webino_package_is_gitea; then
    printf '%s\n' "${WEBINO_PACKAGE_BASE}/${slug}/archive/${ref}.tar.gz"
    printf '%s\n' "${WEBINO_PACKAGE_BASE}/api/v1/repos/${slug}/archive/${ref}.tar.gz"
    return 0
  fi

  if [[ "$ref" =~ ^v[0-9] ]] || [[ "$ref" =~ ^[0-9]+\.[0-9] ]]; then
    printf '%s\n' "https://github.com/${slug}/archive/refs/tags/${ref}.tar.gz"
    printf '%s\n' "https://codeload.github.com/${slug}/tar.gz/refs/tags/${ref}"
  else
    printf '%s\n' "https://github.com/${slug}/archive/refs/heads/${ref}.tar.gz"
    printf '%s\n' "https://codeload.github.com/${slug}/tar.gz/refs/heads/${ref}"
  fi
}

webino_package_git_url() {
  local slug="${1:-$WEBINO_REPO_SLUG}"
  if webino_package_is_gitea; then
    printf '%s/%s.git' "$WEBINO_PACKAGE_BASE" "$slug"
  else
    printf 'https://github.com/%s.git' "$slug"
  fi
}

webino_package_latest_release_tag() {
  local repo_slug="$1" prerelease="$2" tag url
  if webino_package_is_gitea; then
    url="${WEBINO_PACKAGE_BASE}/api/v1/repos/${repo_slug}/releases?draft=false&pre-release=${prerelease}&limit=1"
    curl -fsSL --connect-timeout 10 --max-time 30 "$url" 2>/dev/null \
      | grep -m1 '"tag_name"' \
      | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/'
    return 0
  fi

  if [[ "$prerelease" == "true" ]]; then
    url="https://api.github.com/repos/${repo_slug}/releases"
    tag=$(curl -fsSL --connect-timeout 10 --max-time 30 "$url" 2>/dev/null \
      | awk '
        /"tag_name"/ { tag=$0; sub(/.*"tag_name"[[:space:]]*:[[:space:]]*"/, "", tag); sub(/".*/, "", tag); have_tag=1 }
        /"prerelease"[[:space:]]*:[[:space:]]*true/ && have_tag { print tag; exit }
        /"tag_name"/ { have_tag=0 }
      ')
  else
    url="https://api.github.com/repos/${repo_slug}/releases/latest"
    tag=$(curl -fsSL --connect-timeout 10 --max-time 30 "$url" 2>/dev/null \
      | grep -m1 '"tag_name"' \
      | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  fi
  printf '%s' "$tag"
}

webino_package_remote_commit_sha() {
  local repo_slug="$1" ref="$2" sha=""
  if webino_package_is_gitea; then
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
    return 0
  fi

  curl -fsSL --connect-timeout 10 --max-time 30 \
    "https://api.github.com/repos/${repo_slug}/commits/${ref}" 2>/dev/null \
    | grep -m1 '"sha"' | sed 's/.*"sha": "\([^"]*\)".*/\1/' || true
}

webino_package_init_defaults
