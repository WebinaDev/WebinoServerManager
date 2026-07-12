package main

import (
	"testing"
)

func TestParseFreeMB(t *testing.T) {
	out := `              total        used        free      shared  buff/cache   available
Mem:           15932        4521        8234         120        3176       11012
Swap:           2047           0        2047`
	stats := parseFreeMB(out)
	if stats.TotalMB != 15932 || stats.UsedMB != 4521 {
		t.Fatalf("unexpected mem stats: %+v", stats)
	}
	if stats.Percent < 28.3 || stats.Percent > 28.5 {
		t.Fatalf("unexpected percent: %v", stats.Percent)
	}
}

func TestParseDfPercent(t *testing.T) {
	out := `Filesystem     1K-blocks     Used Available Use% Mounted on
/dev/sda1      102626232 45678901  51847331  47% /`
	stats := parseDfPercent(out)
	if stats.Percent != 47 {
		t.Fatalf("expected 47%% got %v", stats.Percent)
	}
	if stats.Total == "" || stats.Used == "" {
		t.Fatalf("expected total/used strings")
	}
}

func TestParseCpuStat(t *testing.T) {
	// Simulate cpu line parsing via parseLoad1 for load
	load := parseLoad1("1.25 0.98 0.75 2/512 99999")
	if load != 1.25 {
		t.Fatalf("expected load1 1.25 got %v", load)
	}
}

func TestParseFreeMBEmpty(t *testing.T) {
	stats := parseFreeMB("")
	if stats.TotalMB != 0 {
		t.Fatalf("expected zero stats for empty input")
	}
}
