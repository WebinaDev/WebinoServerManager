#!/usr/bin/env bash
# Platform-level TUI menus.

tui_platform_setup() {
  if platform_is_initialized; then
    if ! platform_is_healthy; then
      if tui_confirm "Platform Stack" "Platform files exist but stack is not fully running.\n\nStart Caddy + Redis now?"; then
        tui_run_step "Starting platform stack..." platform_ensure_ready
        tui_msg "Platform Ready" "Platform stack is running."
        return 0
      fi
      if tui_confirm "Repair Platform" "Repair platform stack?\n\nSyncs compose template, ensures Docker network, and restarts Caddy + Redis."; then
        tui_run_step "Repairing platform..." platform_repair
        tui_msg "Platform Repaired" "Platform stack repaired and running."
        return 0
      fi
    fi
    local status
    status=$(platform_status)
    tui_msg "Platform Status" "$status"
    if [[ "${TUI_USE_DIALOG:-false}" == true ]] && platform_is_healthy; then
      local action
      action=$(tui_dialog --title "Platform Actions" --menu "Platform is running. Choose an action:" 14 72 4 \
        1 "Back" \
        2 "Repair stack (sync compose + network + restart)" \
        3 "Restart stack (Caddy + Redis)" \
        ) || return 0
      case "$action" in
        2)
          tui_run_step "Repairing platform..." platform_repair
          tui_msg "Platform Repaired" "Platform stack repaired and running."
          ;;
        3)
          tui_run_step "Restarting platform stack..." platform_stack_restart
          tui_msg "Platform Restarted" "Platform stack restarted."
          ;;
        *) return 0 ;;
      esac
    fi
  else
    if tui_confirm "Platform Setup" "Initialize multi-site platform at ${WEBINA_DATA_ROOT}?"; then
      tui_run_step "Initializing platform..." init_platform
      tui_msg "Platform Ready" "Platform initialized successfully."
    fi
  fi
}

tui_platform_logs() {
  local choice logs
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    choice=$(tui_dialog --title "Platform Logs" --menu "Select service:" 12 72 4 \
      1 "All platform logs" \
      2 "Caddy" \
      3 "Redis" \
      ) || return 0
    case "$choice" in
      1) logs=$(platform_logs "" 150) ;;
      2) logs=$(platform_logs caddy 150) ;;
      3) logs=$(platform_logs redis 150) ;;
      *) return 0 ;;
    esac
    tui_dialog --title "Platform Logs" --scrolltext --msgbox "$logs" 22 78
  else
    platform_logs "" 150
    read -r -p "Press Enter..."
  fi
}

tui_rebuild_platform_images() {
  platform_is_initialized || { tui_msg "Not Ready" "Platform not initialized.\nRun Platform Setup first."; return; }
  if tui_confirm "Rebuild Images" "Rebuild Docker images for all installed products?"; then
    tui_run_step "Rebuilding product images..." rebuild_platform_images
    tui_msg "Images" "Product images rebuilt.\n\nRun 'Update Site' on each site to apply."
  fi
}
