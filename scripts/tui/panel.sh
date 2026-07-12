#!/usr/bin/env bash

detect_panel_ip() {
  local ip=""
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "$ip" ]]; then
    ip=$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || echo "localhost")
  fi
  echo "$ip"
}

tui_web_panel() {
  if tui_confirm "Web Panel" "Start WebinoServer web control panel (API + Next.js + docs + agent)?"; then
    tui_run_step "Starting web panel..." bash "${ROOT}/scripts/install/panel.sh" up
    local ip port
    ip=$(detect_panel_ip)
    port="${PANEL_HTTP_PORT:-2090}"
    tui_msg "Web Panel" "Panel started.\n\nOpen in browser:\nhttp://${ip}:${port}\n\nComplete the setup wizard on first visit.\n\nAPI docs: http://${ip}:${PANEL_DOCS_PORT:-2091}"
  fi
}
