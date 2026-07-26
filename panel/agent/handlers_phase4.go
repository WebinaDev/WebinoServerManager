package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

func handleSystemInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethod(w)
		return
	}
	info := collectSystemInfo()
	data, _ := json.Marshal(info)
	writeJSON(w, http.StatusOK, envelope{OK: true, Data: data})
}

func collectSystemInfo() map[string]any {
	hostname, _ := os.Hostname()
	uptime := readFirstLine("/proc/uptime")
	loadAvg := readFirstLine("/proc/loadavg")
	kernel, _ := runArgv([]string{"uname", "-sr"}, "")
	osRelease, _ := runArgv([]string{"uname", "-a"}, "")
	memOut, _ := runArgv([]string{"free", "-m"}, "")
	diskOutHuman, _ := runArgv([]string{"df", "-h", "/"}, "")
	diskOutRaw, _ := runArgv([]string{"df", "-P", "/"}, "")
	cpuPercent := sampleCpuPercent()
	mem := parseFreeMB(memOut)
	disk := parseDfPercent(diskOutRaw)
	load1 := parseLoad1(loadAvg)

	var uptimeSeconds float64
	if parts := strings.Fields(uptime); len(parts) > 0 {
		uptimeSeconds, _ = strconv.ParseFloat(parts[0], 64)
	}

	info := map[string]any{
		"hostname":       hostname,
		"kernel":         strings.TrimSpace(kernel),
		"os":             strings.TrimSpace(osRelease),
		"uptime_seconds": uptimeSeconds,
		"load_average":   strings.TrimSpace(loadAvg),
		"load1":          load1,
		"cpu_percent":    cpuPercent,
		"mem_total_mb":   mem.TotalMB,
		"mem_used_mb":    mem.UsedMB,
		"mem_percent":    mem.Percent,
		"disk_total":     disk.Total,
		"disk_used":      disk.Used,
		"disk_percent":   disk.Percent,
		"memory":         strings.TrimSpace(memOut),
		"disk":           strings.TrimSpace(diskOutHuman),
		"collected_at":   time.Now().UTC().Format(time.RFC3339),
	}
	enrichSystemInfoIO(info)
	return info
}

func readFirstLine(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	return strings.TrimSpace(line)
}

func handleBackups(w http.ResponseWriter, r *http.Request) {
	handleBackupsExtended(w, r)
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
