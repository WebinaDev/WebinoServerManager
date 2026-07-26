package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListSitesFromRegistry(t *testing.T) {
	dir := t.TempDir()
	reg := filepath.Join(dir, "registry.json")
	if err := os.WriteFile(reg, []byte(`{"sites":[{"slug":"a","domain":"a.test","product":"Webino","channel":"LTS"}]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("WEBINA_REGISTRY_PATH", reg)

	sites := listSitesFromRegistry()
	if len(sites) != 1 || sites[0]["slug"] != "a" || sites[0]["product"] != "Webino" {
		t.Fatalf("unexpected sites: %#v", sites)
	}
}

func TestListProductsInstalled(t *testing.T) {
	dir := t.TempDir()
	prod := filepath.Join(dir, "Webino")
	if err := os.MkdirAll(prod, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(prod, ".webino-channel"), []byte("LTS\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("WEBINA_PRODUCTS_DIR", dir)

	products := listProductsInstalled()
	if len(products) != 1 || products[0]["name"] != "Webino" || products[0]["channel"] != "LTS" {
		t.Fatalf("unexpected products: %#v", products)
	}
}
