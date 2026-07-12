#!/usr/bin/env bash
# Centralized Docker build helper for product images.

product_docker_collect_images() {
  local dockerfile="$1"
  local -n _out=$2
  [[ -f "$dockerfile" ]] || return 0
  local line image seen=""
  _out=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      FROM\ *)
        image="${line#FROM }"
        image="${image%% *}"
        image="${image%%@*}"
        ;;
      COPY\ --from=*)
        image="${line#COPY --from=}"
        image="${image%% *}"
        ;;
      *) continue ;;
    esac
    [[ -n "$image" && "$image" != builder && "$image" != deps && "$image" != runner ]] || continue
    [[ " $seen " == *" $image "* ]] && continue
    seen="$seen $image"
    _out+=("$image")
  done < "$dockerfile"
}

product_docker_prepull() {
  local dockerfile="$1"
  local -a images=()
  product_docker_collect_images "$dockerfile" images
  [[ ${#images[@]} -gt 0 ]] || return 0

  # shellcheck source=scripts/install/docker-registry.sh
  source "${ROOT}/scripts/install/docker-registry.sh"
  log "Pre-pulling ${#images[@]} product build image(s)..."
  docker_registry_pull_images "${images[@]}" || warn "Product build image pre-pull had issues — build may still succeed from cache"
}

product_docker_build_hints() {
  cat <<'EOF'

Product Docker build failed — common fixes:
  1. Host network (DNS/NAT issues):
       WEBINA_DOCKER_BUILD_NETWORK=host webina product install Webino
  2. Auto-retry with host network:
       WEBINA_DOCKER_BUILD_RETRY_HOST=1 webina product install Webino
  3. Debian mirror (if deb.debian.org blocked):
       WEBINA_APT_MIRROR=mirror.example/debian webina product install Webino
  4. Low RAM during build — add swap, then rebuild:
       webina product rebuild Webino

See docs/TROUBLESHOOTING.md — Product image build
EOF
}

product_docker_assemble_args() {
  local -n _out=$1
  local network="${2:-}"
  _out=()
  if docker buildx version >/dev/null 2>&1; then
    _out+=(--progress=plain)
  fi
  [[ -n "${WEBINA_APT_MIRROR:-}" ]] && _out+=(--build-arg "APT_MIRROR=${WEBINA_APT_MIRROR}")
  _out+=(--build-arg "FORCE_APT_IPV4=${WEBINA_FORCE_APT_IPV4:-1}")
  [[ -n "${HTTP_PROXY:-}" ]] && _out+=(--build-arg "HTTP_PROXY=${HTTP_PROXY}")
  [[ -n "${HTTPS_PROXY:-}" ]] && _out+=(--build-arg "HTTPS_PROXY=${HTTPS_PROXY}")
  [[ -n "${NO_PROXY:-}" ]] && _out+=(--build-arg "NO_PROXY=${NO_PROXY}")
  [[ -n "$network" ]] && _out+=(--network="$network")
}

product_docker_build() {
  local dockerfile="$1" tag="$2" context="$3"
  local -a build_args=()
  local network_used="${WEBINA_DOCKER_BUILD_NETWORK:-}"

  have docker || die "Docker required for product image build"
  export BUILDKIT_NO_CLIENT_TOKEN="${BUILDKIT_NO_CLIENT_TOKEN:-1}"
  export BUILDX_NO_DEFAULT_ATTESTATIONS="${BUILDX_NO_DEFAULT_ATTESTATIONS:-1}"
  export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"

  product_docker_prepull "$dockerfile"
  product_docker_assemble_args build_args "$network_used"

  log "Building ${tag} from ${dockerfile}..."

  if docker build "${build_args[@]}" -f "$dockerfile" -t "$tag" "$context"; then
    return 0
  fi

  if [[ "${WEBINA_DOCKER_BUILD_RETRY_HOST:-0}" == "1" && "$network_used" != "host" ]]; then
    warn "Build failed — retrying with --network=host..."
    product_docker_assemble_args build_args host
    if docker build "${build_args[@]}" -f "$dockerfile" -t "$tag" "$context"; then
      return 0
    fi
  fi

  product_docker_build_hints >&2
  return 1
}
