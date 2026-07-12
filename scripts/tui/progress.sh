#!/usr/bin/env bash
# Progress wrappers for long-running install steps.

tui_run_with_progress() {
  local title="$1"
  shift
  local log_file
  log_file=$(mktemp)

  if [[ "${TUI_USE_DIALOG:-false}" == true ]] && have dialog && [[ -e /dev/tty ]]; then
    (
      set +e
      "$@" >"$log_file" 2>&1
      echo $? >"${log_file}.exit"
    ) &
    local pid=$!

    dialog --title "$title" --programbox 20 78 >/dev/tty 2>/dev/tty < <(
      while kill -0 "$pid" 2>/dev/null; do
        tail -n 14 "$log_file" 2>/dev/null || true
        echo "--- elapsed: ${SECONDS}s ---"
        sleep 1
      done
      tail -n 15 "$log_file" 2>/dev/null || true
    ) || true

    wait "$pid"
    local exit_code=0
    [[ -f "${log_file}.exit" ]] && exit_code=$(cat "${log_file}.exit")
    if [[ "$exit_code" -ne 0 ]]; then
      dialog --title "Error" --scrolltext --msgbox "$(tail -n 40 "$log_file")" 20 78 \
        >/dev/tty 2>/dev/tty </dev/tty || true
      rm -f "$log_file" "${log_file}.exit"
      return "$exit_code"
    fi
    rm -f "$log_file" "${log_file}.exit"
    return 0
  fi

  log "$title"
  "$@"
}

tui_run_step() {
  local title="$1"
  shift
  tui_run_with_progress "$title" "$@"
}
