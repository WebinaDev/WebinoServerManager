#!/usr/bin/env bash
# Sites list and create TUI.

tui_sites_list_filter() {
  local filter="${1:-}"
  local slugs filtered=()
  local slug line
  while IFS= read -r slug; do
    [[ -n "$slug" ]] || continue
    if [[ -z "$filter" ]] || [[ "$slug" == *"$filter"* ]]; then
      local domain
      domain=$(registry_get_field "$slug" domain 2>/dev/null || echo "?")
      local status
      status=$(site_container_status "$slug" 2>/dev/null || echo "unknown")
      filtered+=("$slug" "${domain} (${status})")
    fi
  done < <(registry_list_slugs)

  printf '%s\n' "${filtered[@]}"
}

tui_sites_list_menu() {
  platform_is_initialized || { tui_msg "Not Ready" "Platform not initialized.\nRun Platform Setup first."; return; }

  local filter="" items choice slug
  while true; do
    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      filter=$(tui_dialog --title "Sites List" --inputbox "Filter sites (empty = all):" 10 72 "$filter") || return 0
    else
      read -r -p "Filter [${filter}]: " filter
    fi

    mapfile -t items < <(tui_sites_list_filter "$filter")
    if [[ ${#items[@]} -eq 0 ]]; then
      tui_msg "Sites" "No sites found.${filter:+ (filter: $filter)}"
      continue
    fi

    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      local menu_args=()
      local i tag
      for ((i=0; i<${#items[@]}; i+=2)); do
        tag=$((i/2 + 1))
        menu_args+=("$tag" "${items[i]} — ${items[i+1]}")
      done
      local site_count=$(( ${#items[@]} / 2 ))
      menu_args+=("0" "Back")
      choice=$(tui_dialog --title "Sites (${site_count} shown)" --menu "Select a site:" 22 78 15 "${menu_args[@]}") || return 0
      [[ "$choice" == "0" ]] && return 0
      slug="${items[$(( (choice - 1) * 2 ))]}"
      tui_site_detail_menu "$slug"
    else
      local n=1 i
      for ((i=0; i<${#items[@]}; i+=2)); do
        echo "  $n) ${items[i]} — ${items[i+1]}"
        n=$((n+1))
      done
      echo "  0) Back"
      read -r -p "Choice: " choice
      [[ "$choice" == "0" ]] && return 0
      if [[ ! "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > n - 1 )); then
        tui_msg "Invalid Choice" "Enter a number between 1 and $(( n - 1 )), or 0 to go back."
        continue
      fi
      slug="${items[$(( (choice - 1) * 2 ))]}"
      tui_site_detail_menu "$slug"
    fi
  done
}

tui_normalize_slug() {
  local slug="$1"
  slug="${slug,,}"
  slug="${slug// /-}"
  printf '%s' "$slug"
}

tui_create_site() {
  platform_is_initialized || { tui_msg "Not Ready" "Platform not initialized.\nRun Platform Setup first."; return; }

  local slug domain aliases product channel
  product=$(tui_select_product "Create Site") || product="$WEBINO_DEFAULT_PRODUCT"
  channel=$(tui_select_channel "$product") || channel="Dev"

  if ! product_source_ready "$product" 2>/dev/null; then
    if tui_confirm "Install Product" "Product ${product} is not installed yet.\n\nInstall ${product} (${channel}) now?"; then
      tui_run_step "Installing ${product}..." product_install "$product" "$channel"
    else
      return 0
    fi
  fi

  while true; do
    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      slug=$(tui_dialog --title "Create Site" --inputbox "Site slug (e.g. shop1):" 10 72) || return 0
      [[ -n "$slug" ]] || continue
      slug=$(tui_normalize_slug "$slug")
      if ! validate_site_slug "$slug"; then
        tui_msg "Invalid Slug" "Use lowercase letters, numbers, hyphens.\nExamples: sara, shop1, my-store"
        continue
      fi
      domain=$(tui_dialog --title "Create Site" --inputbox "Primary domain:" 10 72) || return 0
      aliases=$(tui_dialog --title "Create Site" --inputbox "Aliases (comma-separated, optional):" 10 72) || aliases=""
    else
      read -r -p "Slug: " slug
      [[ -n "$slug" ]] || continue
      slug=$(tui_normalize_slug "$slug")
      if ! validate_site_slug "$slug"; then
        tui_msg "Invalid Slug" "Use lowercase letters, numbers, hyphens.\nExamples: sara, shop1, my-store"
        continue
      fi
      read -r -p "Domain: " domain
      read -r -p "Aliases (optional): " aliases
    fi

    [[ -n "$slug" && -n "$domain" ]] || { tui_msg "Error" "Slug and domain are required."; continue; }

    if ! validate_domain "$domain"; then
      tui_msg "Invalid Domain" "Use a valid hostname with no spaces.\nExample: shop.example.com"
      continue
    fi

    if ! validate_aliases "$aliases"; then
      tui_msg "Invalid Aliases" "Each alias must be a valid hostname.\nUse comma-separated values."
      continue
    fi

    local count
    count=$(registry_count)
    local note=""
    if [[ "$count" -ge 10 ]]; then
      note="\n\nNote: ${count} sites already exist. Each site uses ~2 containers."
    fi

    if tui_confirm "Create Site" "Create ${product} site '${slug}' for https://${domain}?${note}"; then
      tui_run_step "Creating site ${slug}..." create_site "$slug" "$domain" "$aliases" "$product" "$channel"
      local login_creds="admin@example.com / password"
      if [[ "$product" == "WebinoERM" ]]; then
        login_creds="admin@webina.local / password"
      fi
      tui_msg "Site Created" "Site '${slug}' (${product}) is live at https://${domain}

Default login: ${login_creds}

IMPORTANT: Change the admin password immediately after first login.

Ensure DNS points to this server for SSL."
    fi
    return 0
  done
}
