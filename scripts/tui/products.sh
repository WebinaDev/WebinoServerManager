#!/usr/bin/env bash
# Product management TUI menus.

tui_select_product() {
  local title="${1:-Select Product}"
  local product
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    product=$(tui_dialog --title "$title" --menu "Choose product:" 12 72 3 \
      "Webino" "Customer site (e-commerce dashboard)" \
      "WebinoERM" "Enterprise CRM / ERP" \
      ) || return 1
    printf '%s' "$product"
    return 0
  fi
  echo "  1) Webino"
  echo "  2) WebinoERM"
  read -r -p "Product [1-2]: " product
  case "$product" in
    1|Webino) printf 'Webino' ;;
    2|WebinoERM) printf 'WebinoERM' ;;
    *) return 1 ;;
  esac
}

tui_select_channel() {
  local product="$1" channel
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    channel=$(tui_dialog --title "Version Channel" --menu \
      "Choose version channel for ${product}:" 13 72 3 \
      "LTS" "Latest stable release" \
      "Beta" "Latest beta (prerelease)" \
      "Dev" "Latest from main branch" \
      ) || return 1
    printf '%s' "$channel"
    return 0
  fi
  echo "  1) LTS  2) Beta  3) Dev"
  read -r -p "Channel [3]: " channel
  case "${channel:-3}" in
    1|LTS) printf 'LTS' ;;
    2|Beta) printf 'Beta' ;;
    *) printf 'Dev' ;;
  esac
}

tui_products_menu() {
  local choice product channel
  if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
    choice=$(tui_dialog --title "Products" --menu \
      "Install or manage product sources and Docker images:" 16 72 5 \
      1 "List products" \
      2 "Install / update product" \
      3 "Rebuild product images" \
      4 "Back" \
      ) || return 0
  else
    echo "  1) List  2) Install/update  3) Rebuild images  0) Back"
    read -r -p "Choice: " choice
    [[ "$choice" == "0" ]] && return 0
  fi

  case "$choice" in
    1)
      local report
      report=$(list_products_status)
      tui_msg "Products" "$report"
      ;;
    2)
      product=$(tui_select_product "Install Product") || return 0
      channel=$(tui_select_channel "$product") || channel="Dev"
      if tui_confirm "Install Product" "Install/update ${product} (${channel})?\n\nThis downloads source and builds Docker images (10–20 min first time)."; then
        tui_run_step "Installing ${product}..." product_install "$product" "$channel"
        tui_msg "Product Ready" "${product} is installed and images are built."
      fi
      ;;
    3)
      product=$(tui_select_product "Rebuild Images") || return 0
      if tui_confirm "Rebuild Images" "Rebuild Docker images for ${product}?"; then
        tui_run_step "Rebuilding ${product} images..." rebuild_product_images "$product"
        tui_msg "Images" "Images rebuilt for ${product}."
      fi
      ;;
    4|*) return 0 ;;
  esac
}
