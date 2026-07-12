#!/usr/bin/env bash
# WebinoServer interactive terminal control panel.

tui_dialog_self_test() {
  [[ -e /dev/tty ]] || return 1
  local dialogrc_backup="${DIALOGRC:-}"

  unset DIALOGRC
  if dialog --infobox "Loading WebinoServer..." 3 40 >/dev/tty 2>/dev/tty </dev/tty; then
    TUI_DIALOG_THEMED=0
    return 0
  fi

  export DIALOGRC="${ROOT}/scripts/dialogrc"
  if dialog --infobox "Loading WebinoServer..." 3 40 >/dev/tty 2>/dev/tty </dev/tty; then
    TUI_DIALOG_THEMED=1
    return 0
  fi

  if [[ -n "$dialogrc_backup" ]]; then
    export DIALOGRC="$dialogrc_backup"
  else
    unset DIALOGRC
  fi
  return 1
}

tui_dialog() {
  if [[ -e /dev/tty ]]; then
    dialog "$@" 2>&1 >/dev/tty </dev/tty
  else
    dialog "$@"
  fi
}

tui_init() {
  export TUI_USE_DIALOG=false

  if [[ ! -t 1 && ! -e /dev/tty ]] || [[ "${TERM:-dumb}" == "dumb" && ! -e /dev/tty ]]; then
    return 0
  fi

  if [[ "${TERM:-dumb}" == "dumb" ]] && [[ -e /dev/tty ]]; then
    export TERM=xterm-256color
  fi

  if ! have dialog; then
    ensure_dialog || return 0
  fi

  if tui_dialog_self_test; then
    export TUI_USE_DIALOG=true
    if [[ "${TUI_DIALOG_THEMED:-0}" == "1" ]]; then
      export DIALOGRC="${ROOT}/scripts/dialogrc"
    else
      unset DIALOGRC
    fi
  else
    warn "dialog self-test failed ($(dialog --version 2>&1 | head -1)) — using text menu"
    export TUI_USE_DIALOG=false
  fi
}

tui_msg() {
  local title="$1"
  local body="$2"
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    tui_dialog --title "$title" --msgbox "$body" 14 72
  else
    echo ""
    echo "=== $title ==="
    printf '%b\n' "$body"
    echo ""
    read -r -p "Press Enter to continue..."
  fi
}

tui_confirm() {
  local title="$1"
  local body="$2"
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    tui_dialog --title "$title" --yesno "$body" 10 72
    return $?
  fi
  printf '%b\n' "$body"
  read -r -p "$title [y/N]: " ans
  [[ "$ans" =~ ^[Yy] ]]
}

tui_system_check() {
  local report verify_out=""
  report=$(preflight_report)
  if [[ -x "${ROOT}/scripts/verify-control-panel.sh" ]]; then
    verify_out=$("${ROOT}/scripts/verify-control-panel.sh" 2>&1) || verify_out="${verify_out:-verify-control-panel.sh failed (exit $?)}"
  else
    verify_out="verify-control-panel.sh not found or not executable"
  fi
  tui_msg "System Check" "${report}

--- Control Panel Verify ---
${verify_out}"
}

tui_text_menu() {
  while true; do
    echo ""
    echo "=== WebinoServer Control Panel ==="
    echo "  1) Platform Setup / Status"
    echo "  2) Sites List"
    echo "  3) Create New Site"
    echo "  4) Products (install / update / rebuild)"
    echo "  5) Platform Logs"
    echo "  6) Rebuild Product Images"
    echo "  7) System Check"
    echo "  8) Web Control Panel"
    echo "  9) Exit"
    echo ""
    read -r -p "Choice [1-9]: " choice
    case "$choice" in
      1) tui_platform_setup ;;
      2) tui_sites_list_menu ;;
      3) tui_create_site ;;
      4) tui_products_menu ;;
      5) tui_platform_logs ;;
      6) tui_rebuild_platform_images ;;
      7) tui_system_check ;;
      8) tui_web_panel ;;
      9|q|Q) break ;;
      *) echo "Invalid choice." ;;
    esac
  done
}

tui_main_loop() {
  # shellcheck source=scripts/tui/progress.sh
  source "${ROOT}/scripts/tui/progress.sh"
  # shellcheck source=scripts/platform/load.sh
  source "${ROOT}/scripts/platform/load.sh"
  # shellcheck source=scripts/tui/platform.sh
  source "${ROOT}/scripts/tui/platform.sh"
  # shellcheck source=scripts/tui/sites.sh
  source "${ROOT}/scripts/tui/sites.sh"
  # shellcheck source=scripts/tui/site-detail.sh
  source "${ROOT}/scripts/tui/site-detail.sh"
  # shellcheck source=scripts/tui/containers.sh
  source "${ROOT}/scripts/tui/containers.sh"
  # shellcheck source=scripts/tui/first-run.sh
  source "${ROOT}/scripts/tui/first-run.sh"
  # shellcheck source=scripts/tui/products.sh
  source "${ROOT}/scripts/tui/products.sh"
  # shellcheck source=scripts/tui/panel.sh
  source "${ROOT}/scripts/tui/panel.sh"

  load_platform_libs
  tui_init

  if [[ "${FIRST_RUN:-false}" == true ]]; then
    run_first_run_wizard
    unset FIRST_RUN
  fi

  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    while true; do
      local choice count_label="" site_count=0
      if platform_is_initialized; then
        site_count=$(registry_count 2>/dev/null || echo 0)
        count_label=" (${site_count} sites)"
      fi
      if ! choice=$(tui_dialog --backtitle "WebinoServer" \
        --title "Control Panel${count_label}" \
        --menu "Select an action:" 20 78 9 \
        1 "Platform Setup / Status" \
        2 "Sites List" \
        3 "Create New Site" \
        4 "Products (install / update / rebuild)" \
        5 "Platform Logs (Caddy, Redis)" \
        6 "Rebuild Product Images" \
        7 "System Check" \
        8 "Web Control Panel (Docker)" \
        9 "Exit" \
        ); then
        break
      fi

      case "$choice" in
        1) tui_platform_setup ;;
        2) tui_sites_list_menu ;;
        3) tui_create_site ;;
        4) tui_products_menu ;;
        5) tui_platform_logs ;;
        6) tui_rebuild_platform_images ;;
        7) tui_system_check ;;
        8) tui_web_panel ;;
        9|*) break ;;
      esac
    done
  else
    tui_text_menu
  fi
}

tui_attach_tty() {
  [[ -e /dev/tty ]] || return 0
  { exec </dev/tty >/dev/tty 2>&1; } 2>/dev/null || true
}

run_tui() {
  tui_attach_tty
  tui_main_loop
}
