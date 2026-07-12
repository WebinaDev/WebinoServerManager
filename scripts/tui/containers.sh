#!/usr/bin/env bash
# Per-container management TUI.

tui_container_menu() {
  local slug="$1"

  while true; do
    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      local choice action service
      choice=$(tui_dialog --title "Containers: ${slug}" --menu "Select container:" 14 72 4 \
        1 "backend" \
        2 "next" \
        0 "Back" \
        ) || break
      [[ "$choice" == "0" ]] && break
      case "$choice" in
        1) service="backend" ;;
        2) service="next" ;;
        *) break ;;
      esac
      tui_container_actions "$slug" "$service"
    else
      echo "  1) backend  2) next  0) Back"
      read -r -p "Container: " c
      [[ "$c" == "0" ]] && break
      case "$c" in
        1) tui_container_actions "$slug" backend ;;
        2) tui_container_actions "$slug" next ;;
      esac
    fi
  done
}

tui_container_actions() {
  local slug="$1" service="$2"

  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    local choice
    choice=$(tui_dialog --title "${slug}/${service}" --menu "Action:" 14 72 6 \
      1 "Start" \
      2 "Stop" \
      3 "Restart" \
      4 "View Logs" \
      5 "Update (recreate)" \
      0 "Back" \
      ) || return 0
    case "$choice" in
      1) tui_run_step "Starting ${service}..." container_action "$slug" "$service" start ;;
      2) tui_run_step "Stopping ${service}..." container_action "$slug" "$service" stop ;;
      3) tui_run_step "Restarting ${service}..." container_action "$slug" "$service" restart ;;
      4)
        local logs
        logs=$(container_logs "$slug" "$service" 150)
        tui_dialog --title "Logs: ${slug}/${service}" --scrolltext --msgbox "$logs" 22 78
        ;;
      5) tui_run_step "Updating ${service}..." container_action "$slug" "$service" update ;;
      0|*) return 0 ;;
    esac
  else
    echo "  1) Start  2) Stop  3) Restart  4) Logs  5) Update  0) Back"
    read -r -p "Action: " a
    case "$a" in
      1) container_action "$slug" "$service" start ;;
      2) container_action "$slug" "$service" stop ;;
      3) container_action "$slug" "$service" restart ;;
      4) container_logs "$slug" "$service" 150; read -r -p "Press Enter..." ;;
      5) container_action "$slug" "$service" update ;;
    esac
  fi
}
