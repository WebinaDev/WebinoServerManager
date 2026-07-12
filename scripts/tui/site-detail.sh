#!/usr/bin/env bash
# Per-site detail TUI menu.

tui_site_detail_menu() {
  local slug="$1"
  registry_site_exists "$slug" || { tui_msg "Error" "Site not found: $slug"; return; }

  while true; do
    local domain status ssl_info
    domain=$(registry_get_field "$slug" domain)
    status=$(site_container_status "$slug")
    ssl_info=$(caddy_ssl_status "$slug" 2>/dev/null || echo "unknown")

    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      local choice
      choice=$(tui_dialog --title "Site: ${slug}" --menu "Domain: ${domain} | Status: ${status} | SSL: ${ssl_info}" 20 78 10 \
        1 "Site URL / Status" \
        2 "Domain & SSL Settings" \
        3 "Start Site" \
        4 "Stop Site" \
        5 "Restart Site" \
        6 "Manage Containers" \
        7 "View Logs" \
        8 "Update Site" \
        9 "Delete Site" \
        0 "Back" \
        ) || break

      case "$choice" in
        1) tui_site_status "$slug" ;;
        2) tui_site_domain_settings "$slug" ;;
        3) tui_run_step "Starting..." site_start "$slug" ;;
        4) tui_run_step "Stopping..." site_stop "$slug" ;;
        5) tui_run_step "Restarting..." site_restart "$slug" ;;
        6) tui_container_menu "$slug" ;;
        7) tui_site_logs_menu "$slug" ;;
        8) tui_run_step "Updating..." site_update "$slug" ;;
        9) tui_site_delete "$slug"
           registry_site_exists "$slug" || break
           ;;
        0|*) break ;;
      esac
    else
      echo ""
      echo "=== Site: $slug ==="
      echo "Domain: $domain | Status: $status | SSL: $ssl_info"
      echo "  1) Status  2) Domain  3) Start  4) Stop  5) Restart"
      echo "  6) Containers  7) Logs  8) Update  9) Delete  0) Back"
      read -r -p "Choice: " choice
      case "$choice" in
        1) tui_site_status "$slug" ;;
        2) tui_site_domain_settings "$slug" ;;
        3) site_start "$slug" ;;
        4) site_stop "$slug" ;;
        5) site_restart "$slug" ;;
        6) tui_container_menu "$slug" ;;
        7) tui_site_logs_menu "$slug" ;;
        8) site_update "$slug" ;;
        9) tui_site_delete "$slug"
           registry_site_exists "$slug" || break
           ;;
        0|q) break ;;
      esac
    fi
  done
}

tui_site_status() {
  local slug="$1"
  local domain ps_out ssl_info
  domain=$(registry_get_field "$slug" domain)
  ssl_info=$(caddy_ssl_status "$slug" 2>/dev/null || echo "unknown")
  ps_out=$(site_ps "$slug" 2>&1 || echo "Could not read container status")
  tui_msg "Site: ${slug}" "URL: https://${domain}\nSSL: ${ssl_info}\nStatus: $(site_container_status "$slug")\n\nContainers:\n${ps_out}"
}

tui_site_domain_settings() {
  local slug="$1"
  local domain aliases
  domain=$(registry_get_field "$slug" domain)
  aliases=$(registry_get_field "$slug" aliases)

  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    domain=$(tui_dialog --title "Domain & SSL" --inputbox "Primary domain:" 10 72 "$domain") || return 0
    aliases=$(tui_dialog --title "Domain & SSL" --inputbox "Aliases (comma-separated):" 10 72 "$aliases") || aliases=""
  else
    read -r -p "Domain [${domain}]: " d; domain="${d:-$domain}"
    read -r -p "Aliases [${aliases}]: " aliases
  fi

  tui_run_step "Updating domain..." update_site_domain "$slug" "$domain" "$aliases"
  tui_msg "Domain Updated" "Site '${slug}' now uses https://${domain}\n\nSSL: $(caddy_ssl_status "$slug")\n\nDNS must point to this server for certificate issuance."
}

tui_site_logs_menu() {
  local slug="$1"
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    local choice logs
    choice=$(tui_dialog --title "Logs: ${slug}" --menu "Select container:" 12 72 4 \
      1 "All site logs" \
      2 "backend" \
      3 "next" \
      ) || return 0
    case "$choice" in
      1) logs=$(site_compose "$slug" logs --tail=150 2>&1) ;;
      2) logs=$(container_logs "$slug" backend 150) ;;
      3) logs=$(container_logs "$slug" next 150) ;;
      *) return 0 ;;
    esac
    tui_dialog --title "Logs: ${slug}" --scrolltext --msgbox "$logs" 22 78
  else
    echo "  1) All  2) backend  3) next"
    read -r -p "Choice: " c
    case "$c" in
      2) container_logs "$slug" backend 150 ;;
      3) container_logs "$slug" next 150 ;;
      *) site_compose "$slug" logs --tail=150 ;;
    esac
    read -r -p "Press Enter..."
  fi
}

tui_site_delete() {
  local slug="$1"
  local typed=""
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    tui_dialog --title "Delete Site" --yesno "Delete site '${slug}' and all its data?\n\nThis cannot be undone." 10 72 || return 0
    typed=$(tui_dialog --title "Confirm Delete" --inputbox "Type slug to confirm:" 10 72) || return 0
  else
    read -r -p "Delete ${slug}? [y/N]: " ans
    [[ "$ans" =~ ^[Yy] ]] || return 0
    read -r -p "Type slug to confirm: " typed
  fi

  if [[ "$typed" != "$slug" ]]; then
    tui_msg "Cancelled" "Confirmation failed. Site not deleted."
    return
  fi

  tui_run_step "Deleting site ${slug}..." delete_site "$slug" "$typed"
  tui_msg "Deleted" "Site '${slug}' has been removed."
}
