package main

import (
	"sync"
	"testing"
	"time"
)

func TestExecLockKeyReadOnlyQuotaUnlocked(t *testing.T) {
	if key := execLockKey([]string{"doveadm", "quota", "get", "-u", "a@example.com"}); key != "" {
		t.Fatalf("expected no lock for quota read, got %q", key)
	}
}

func TestExecLockKeyNginxLocked(t *testing.T) {
	if key := execLockKey([]string{"nginx", "-t"}); key != "nginx" {
		t.Fatalf("expected nginx lock, got %q", key)
	}
}

func TestConcurrentReadsParallel(t *testing.T) {
	var active int
	var peak int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			unlock := acquireExecLock("")
			defer unlock()
			mu.Lock()
			active++
			if active > peak {
				peak = active
			}
			mu.Unlock()
			time.Sleep(20 * time.Millisecond)
			mu.Lock()
			active--
			mu.Unlock()
		}()
	}
	wg.Wait()
	if peak < 2 {
		t.Fatalf("expected parallel unlocked execution, peak=%d", peak)
	}
}

func TestSameKeySerializes(t *testing.T) {
	var active int
	var peak int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			unlock := acquireExecLock("nginx")
			defer unlock()
			mu.Lock()
			active++
			if active > peak {
				peak = active
			}
			mu.Unlock()
			time.Sleep(20 * time.Millisecond)
			mu.Lock()
			active--
			mu.Unlock()
		}()
	}
	wg.Wait()
	if peak != 1 {
		t.Fatalf("expected serialized nginx lock, peak=%d", peak)
	}
}
