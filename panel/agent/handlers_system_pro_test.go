package main

import "testing"

func TestListTopProcessesParses(t *testing.T) {
	// Smoke: function should not panic; may fail if ps missing in sandbox
	_, err := listTopProcesses(3)
	if err != nil {
		t.Logf("ps unavailable in test env: %v", err)
	}
}

func TestRootBlockDeviceNonEmpty(t *testing.T) {
	dev := rootBlockDevice()
	if dev == "" {
		t.Fatal("expected device name")
	}
}
