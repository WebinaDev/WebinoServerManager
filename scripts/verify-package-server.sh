#!/usr/bin/env bash
# Verify GitHub (default) or legacy Gitea endpoints used by bootstrap.
set -euo pipefail

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/install/package-urls.sh
source "${_SCRIPT_DIR}/install/package-urls.sh"

BRANCH="${WEBINO_BRANCH:-main}"

pass=0
fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code

  printf 'Checking %-28s ... ' "$name"
  code=$(curl -fsSLo /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 30 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK ($code)"
    pass=$((pass + 1))
  else
    echo "FAIL (HTTP $code, expected $expect)"
    echo "  URL: $url"
    fail=$((fail + 1))
  fi
}

echo "Package server verification: ${WEBINO_REPO_SLUG} (${WEBINO_PACKAGE_BASE})"
echo

check "raw bootstrap" "$(webino_package_bootstrap_url "$WEBINO_REPO_SLUG" "$BRANCH")"

if webino_package_is_gitea; then
  check "web archive" \
    "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/archive/${BRANCH}.tar.gz"
  check "API archive" \
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${WEBINO_REPO_SLUG}/archive/${BRANCH}.tar.gz"
  check "git smart HTTP" \
    "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/info/refs?service=git-upload-pack"
  check "branch ref API" \
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${WEBINO_REPO_SLUG}/git/refs/heads/${BRANCH}"
else
  check "branch archive" \
    "https://github.com/${WEBINO_REPO_SLUG}/archive/refs/heads/${BRANCH}.tar.gz"
  check "codeload archive" \
    "https://codeload.github.com/${WEBINO_REPO_SLUG}/tar.gz/refs/heads/${BRANCH}"
  check "commits API" \
    "https://api.github.com/repos/${WEBINO_REPO_SLUG}/commits/${BRANCH}"
fi

printf 'Checking %-28s ... ' "git ls-remote"
if git ls-remote "$(webino_package_git_url "$WEBINO_REPO_SLUG")" "refs/heads/${BRANCH}" >/dev/null 2>&1; then
  echo "OK"
  pass=$((pass + 1))
else
  echo "FAIL"
  echo "  URL: $(webino_package_git_url "$WEBINO_REPO_SLUG")"
  fail=$((fail + 1))
fi

echo
echo "Results: ${pass} passed, ${fail} failed"
if [[ "$fail" -gt 0 ]]; then
  if webino_package_is_gitea; then
    echo "See docs/GITEA_PACKAGE_SERVER.md for legacy Gitea fixes."
  else
    echo "Verify the repository is public: https://github.com/${WEBINO_REPO_SLUG}"
  fi
  exit 1
fi
