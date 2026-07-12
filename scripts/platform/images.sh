#!/usr/bin/env bash
# Build shared platform Docker images (delegates to per-product builds).

# Kept for backward compatibility — builds images for all installed products.
build_platform_images() {
  load_products_libs
  build_all_installed_product_images
}
