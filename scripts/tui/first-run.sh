#!/usr/bin/env bash
# First-run welcome after server bootstrap.

run_first_run_wizard() {
  if ! platform_is_initialized; then
    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      if tui_confirm "Platform Setup" "Initialize multi-site platform at ${WEBINA_DATA_ROOT}?"; then
        tui_run_step "Initializing platform..." init_platform
      fi
    else
      read -r -p "Initialize platform at ${WEBINA_DATA_ROOT}? [Y/n]: " ans
      [[ "$ans" =~ ^[Nn] ]] || tui_run_step "Initializing platform..." init_platform
    fi
  fi

  if ! platform_is_initialized; then
    tui_msg "Setup Paused" "Platform not initialized.\nYou can initialize from the control panel menu."
    return 0
  fi

  if ! product_source_ready "Webino"; then
    if [[ "${TUI_USE_DIALOG:-false}" == true ]]; then
      if tui_confirm "Install Webino" "Install the Webino product (source + Docker images)?\n\nFirst build may take 10–20 minutes."; then
        tui_run_step "Installing Webino..." product_install Webino Dev
      fi
    else
      read -r -p "Install Webino product now? [Y/n]: " ans
      [[ "$ans" =~ ^[Nn] ]] || product_install Webino Dev
    fi
  fi

  tui_msg "WebinoServer Ready" \
    "Platform is initialized.\n\nUse 'Products' to install Webino or WebinoERM.\nUse 'Create New Site' when ready.\n\nEnsure DNS points to this server for SSL."
}
