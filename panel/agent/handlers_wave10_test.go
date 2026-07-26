package main

import "testing"

func TestHandleDatabaseExtraActionsRepairRequiresName(t *testing.T) {
	rr := &responseRecorder{header: make(map[string][]string)}
	handleDatabaseExtraActions(rr, map[string]any{"action": "repair"})
	if rr.status != 400 {
		t.Fatalf("expected 400, got %d", rr.status)
	}
}

func TestReadPassivePortRangeDefault(t *testing.T) {
	got := readPassivePortRange()
	if got == "" {
		t.Fatal("expected default passive range")
	}
}

func TestIntVal(t *testing.T) {
	if intVal(float64(42)) != 42 {
		t.Fatal("float64 conversion failed")
	}
	if intVal("10") != 10 {
		t.Fatal("string conversion failed")
	}
}

type responseRecorder struct {
	status int
	body   []byte
	header map[string][]string
}

func (r *responseRecorder) Header() map[string][]string { return r.header }
func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body = append(r.body, b...)
	if r.status == 0 {
		r.status = 200
	}
	return len(b), nil
}
func (r *responseRecorder) WriteHeader(statusCode int) { r.status = statusCode }
