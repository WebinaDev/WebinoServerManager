package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func handleSystemProcesses(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		limit := 5
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}
		if limit > 50 {
			limit = 50
		}
		list, err := listTopProcesses(limit)
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error()})
			return
		}
		data, _ := json.Marshal(map[string]any{"processes": list})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	case http.MethodPost:
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid body"})
			return
		}
		action := strVal(body["action"])
		if action != "kill" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "unknown action"})
			return
		}
		pid := intVal(body["pid"], 0)
		if pid <= 1 {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "invalid pid"})
			return
		}
		sig := strings.ToUpper(strVal(body["signal"]))
		if sig == "" {
			sig = "TERM"
		}
		if sig != "TERM" && sig != "KILL" {
			writeJSON(w, http.StatusBadRequest, envelope{OK: false, Error: "signal must be TERM or KILL"})
			return
		}
		argv := []string{"kill", "-" + sig, strconv.Itoa(pid)}
		out, err := runArgv(argv, "")
		if err != nil {
			writeJSON(w, http.StatusOK, envelope{OK: false, Error: err.Error() + ": " + out})
			return
		}
		data, _ := json.Marshal(map[string]any{"pid": pid, "signal": sig, "output": out})
		writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
	default:
		writeMethod(w)
	}
}

type procRow struct {
	PID     int     `json:"pid"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Mem     float64 `json:"mem"`
	Command string  `json:"command"`
}

func listTopProcesses(limit int) ([]procRow, error) {
	out, err := runArgv([]string{"ps", "-eo", "pid,user,pcpu,pmem,comm", "--sort=-pcpu"}, "")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	rows := make([]procRow, 0, limit)
	for i, line := range lines {
		if i == 0 {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, _ := strconv.Atoi(fields[0])
		cpu, _ := strconv.ParseFloat(fields[2], 64)
		mem, _ := strconv.ParseFloat(fields[3], 64)
		cmd := strings.Join(fields[4:], " ")
		rows = append(rows, procRow{PID: pid, User: fields[1], CPU: cpu, Mem: mem, Command: cmd})
		if len(rows) >= limit {
			break
		}
	}
	return rows, nil
}

func sampleNicRates() map[string]any {
	first := readNetDev()
	time.Sleep(200 * time.Millisecond)
	second := readNetDev()
	type ifaceStat struct {
		Name string
		Rx   uint64
		Tx   uint64
	}
	var best ifaceStat
	var bestTotal uint64
	for name, a := range first {
		if name == "lo" {
			continue
		}
		b, ok := second[name]
		if !ok {
			continue
		}
		rx := b.rx - a.rx
		tx := b.tx - a.tx
		total := rx + tx
		if total >= bestTotal {
			bestTotal = total
			best = ifaceStat{Name: name, Rx: rx, Tx: tx}
		}
	}
	scale := 5.0 // 200ms → per-second
	return map[string]any{
		"iface":    best.Name,
		"rx_bps":   float64(best.Rx) * scale,
		"tx_bps":   float64(best.Tx) * scale,
		"rx_bytes": best.Rx,
		"tx_bytes": best.Tx,
	}
}

type netCounters struct {
	rx uint64
	tx uint64
}

func readNetDev() map[string]netCounters {
	out := map[string]netCounters{}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseUint(fields[0], 10, 64)
		tx, _ := strconv.ParseUint(fields[8], 10, 64)
		out[name] = netCounters{rx: rx, tx: tx}
	}
	return out
}

func sampleDiskIORates() map[string]any {
	dev := rootBlockDevice()
	first := readDiskstats(dev)
	time.Sleep(200 * time.Millisecond)
	second := readDiskstats(dev)
	scale := 5.0
	sectorsRead := second.readSectors - first.readSectors
	sectorsWrite := second.writeSectors - first.writeSectors
	// 512 bytes per sector typically
	return map[string]any{
		"device":     dev,
		"read_bps":   float64(sectorsRead) * 512 * scale,
		"write_bps":  float64(sectorsWrite) * 512 * scale,
		"read_sect":  sectorsRead,
		"write_sect": sectorsWrite,
	}
}

type diskCounters struct {
	readSectors  uint64
	writeSectors uint64
}

func rootBlockDevice() string {
	b, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return "sda"
	}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 || fields[1] != "/" {
			continue
		}
		base := filepath.Base(fields[0])
		// strip partition digits: nvme0n1p2 → nvme0n1, sda1 → sda
		if strings.HasPrefix(base, "nvme") {
			if i := strings.LastIndex(base, "p"); i > 0 {
				return base[:i]
			}
		}
		return strings.TrimRight(base, "0123456789")
	}
	return "sda"
}

func readDiskstats(dev string) diskCounters {
	b, err := os.ReadFile("/proc/diskstats")
	if err != nil {
		return diskCounters{}
	}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 14 {
			continue
		}
		if fields[2] != dev {
			continue
		}
		r, _ := strconv.ParseUint(fields[5], 10, 64)
		w, _ := strconv.ParseUint(fields[9], 10, 64)
		return diskCounters{readSectors: r, writeSectors: w}
	}
	return diskCounters{}
}

// enrichSystemInfoIO adds nic + disk_io + top_processes to system info map (mutates).
func enrichSystemInfoIO(info map[string]any) {
	info["nic"] = sampleNicRates()
	info["disk_io"] = sampleDiskIORates()
	procs, err := listTopProcesses(5)
	if err == nil {
		info["top_processes"] = procs
	}
}