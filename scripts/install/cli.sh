#!/usr/bin/env bash
# Register the global webina CLI command (WebinoServer install path).

WEBINO_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/webina"
WEBINO_INSTALL_PATH_FILE="${WEBINO_CONFIG_DIR}/install-path"
WEBINO_CLI_NAME="webina"

webina_cli_source() {
  printf '%s' "${ROOT}/bin/webina"
}

webina_cli_targets() {
  printf '%s\n' "/usr/local/bin/${WEBINO_CLI_NAME}" "${HOME}/.local/bin/${WEBINO_CLI_NAME}"
}

register_webina_cli() {
  local source_path target dir
  source_path="$(webina_cli_source)"

  [[ -f "$source_path" ]] || {
    warn "Missing CLI script: $source_path"
    return 1
  }
  chmod +x "$source_path"

  mkdir -p "$WEBINO_CONFIG_DIR"
  printf '%s\n' "$ROOT" >"$WEBINO_INSTALL_PATH_FILE"
  log "Saved install path to ${WEBINO_INSTALL_PATH_FILE#$HOME/~}"

  local linked=false
  while IFS= read -r target; do
    [[ -n "$target" ]] || continue
    dir="$(dirname "$target")"
    if [[ "$target" == "/usr/local/bin/${WEBINO_CLI_NAME}" ]] && [[ ! -w "$dir" ]]; then
      if have sudo; then
        if sudo ln -sf "$source_path" "$target"; then
          log "Linked ${WEBINO_CLI_NAME} -> $target (sudo)"
          linked=true
          break
        fi
      fi
      continue
    fi
    if [[ -w "$dir" ]] || mkdir -p "$dir" 2>/dev/null; then
      ln -sf "$source_path" "$target"
      log "Linked ${WEBINO_CLI_NAME} -> $target"
      linked=true
      break
    fi
  done < <(webina_cli_targets)

  if [[ "$linked" == false ]]; then
    warn "Could not link ${WEBINO_CLI_NAME} to PATH."
    warn "Add this to your shell profile:"
    warn "  export PATH=\"${ROOT}/bin:\$PATH\""
    return 1
  fi

  if ! command -v "${WEBINO_CLI_NAME}" >/dev/null 2>&1; then
    warn "${WEBINO_CLI_NAME} installed but not on PATH yet."
    warn "Ensure ~/.local/bin is in your PATH, then run: webina"
  else
    log "Run '${WEBINO_CLI_NAME}' anytime to open the control panel."
  fi
}

unregister_webina_cli() {
  local target removed=false
  while IFS= read -r target; do
    [[ -L "$target" && "$(readlink -f "$target")" == "$(readlink -f "$(webina_cli_source)")" ]] || continue
    rm -f "$target"
    log "Removed CLI link: $target"
    removed=true
  done < <(webina_cli_targets)

  if [[ -f "$WEBINO_INSTALL_PATH_FILE" ]]; then
    rm -f "$WEBINO_INSTALL_PATH_FILE"
    log "Removed install path config"
  fi

  rmdir "$WEBINO_CONFIG_DIR" 2>/dev/null || true

  if [[ "$removed" == false ]]; then
    warn "No ${WEBINO_CLI_NAME} CLI link found to remove"
  fi
}
