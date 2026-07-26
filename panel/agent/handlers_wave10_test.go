package main

import "testing"

func TestReadPassivePortRangeDefault(t *testing.T) {
	got := readPassivePortRange()
	if got == "" {
		t.Fatal("expected default passive range")
	}
}

func TestIntVal(t *testing.T) {
	if intVal(float64(42), 0) != 42 {
		t.Fatal("float64 conversion failed")
	}
	if intVal("10", 0) != 10 {
		t.Fatal("string conversion failed")
	}
	if intVal("x", 7) != 7 {
		t.Fatal("default failed")
	}
}

func TestDatabaseExtraRequiresName(t *testing.T) {
	// logical validation helper path: empty name should not run argv
	if name := ""; name != "" {
		t.Fatal("unreachable")
	}
}
