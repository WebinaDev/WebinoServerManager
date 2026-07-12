#!/usr/bin/env bash
# Verify package.webina.dev (Gitea) endpoints used by bootstrap.
set -euo pipefail

WEBINO_PACKAGE_BASE="${WEBINO_PACKAGE_BASE:-https://package.webina.dev}"
WEBINO_REPO_SLUG="${WEBINO_REPO_SLUG:-webina/WebinoServer}"
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

echo "Package server verification: ${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}"
echo

check "raw bootstrap" \
  "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/raw/branch/${BRANCH}/bootstrap.sh"
check "web archive" \
  "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/archive/${BRANCH}.tar.gz"
check "API archive" \
  "${WEBINO_PACKAGE_BASE}/api/v1/repos/${WEBINO_REPO_SLUG}/archive/${BRANCH}.tar.gz"
check "git smart HTTP" \
  "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/info/refs?service=git-upload-pack"
check "branch ref API" \
  "${WEBINO_PACKAGE_BASE}/api/v1/repos/${WEBINO_REPO_SLUG}/git/refs/heads/${BRANCH}"

printf 'Checking %-28s ... ' "git ls-remote"
if git ls-remote "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}.git" "refs/heads/${BRANCH}" >/dev/null 2>&1; then
  echo "OK"
  pass=$((pass + 1))
else
  echo "FAIL"
  echo "  URL: ${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}.git"
  fail=$((fail + 1))
fi

echo
echo "Results: ${pass} passed, ${fail} failed"
if [[ "$fail" -gt 0 ]]; then
  echo "See docs/GITEA_PACKAGE_SERVER.md for server-side fixes."
  exit 1
fi
