package main

import (
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	cpuCacheMu sync.Mutex
	cpuCached  float64
	cpuCachedAt time.Time
)

type memStats struct {
	TotalMB int
	UsedMB  int
	Percent float64
}

type diskStats struct {
	Total   string
	Used    string
	Percent float64
}

func parseFreeMB(output string) memStats {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 3 || fields[0] != "Mem:" {
			continue
		}
		total, err1 := strconv.Atoi(fields[1])
		used, err2 := strconv.Atoi(fields[2])
		if err1 != nil || err2 != nil || total <= 0 {
			return memStats{}
		}
		pct := float64(used) / float64(total) * 100

		return memStats{TotalMB: total, UsedMB: used, Percent: pct}
	}

	return memStats{}
}

func parseDfPercent(output string) diskStats {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Filesystem") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pctStr := strings.TrimSuffix(fields[4], "%")
		pct, err := strconv.ParseFloat(pctStr, 64)
		if err != nil {
			continue
		}

		return diskStats{Total: fields[1], Used: fields[2], Percent: pct}
	}

	return diskStats{}
}

func parseLoad1(loadAvg string) float64 {
	fields := strings.Fields(loadAvg)
	if len(fields) == 0 {
		return 0
	}
	v, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}

	return v
}

func readCpuStat() (idle, total uint64, ok bool) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, false
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, 0, false
	}
	var vals []uint64
	for _, f := range fields[1:] {
		v, err := strconv.ParseUint(f, 10, 64)
		if err != nil {
			return 0, 0, false
		}
		vals = append(vals, v)
	}
	if len(vals) < 4 {
		return 0, 0, false
	}
	idle = vals[3]
	if len(vals) > 4 {
		idle += vals[4]
	}
	for _, v := range vals {
		total += v
	}

	return idle, total, true
}

func sampleCpuPercent() float64 {
	cpuCacheMu.Lock()
	defer cpuCacheMu.Unlock()
	if time.Since(cpuCachedAt) < 2*time.Second {
		return cpuCached
	}
	idle1, total1, ok1 := readCpuStat()
	if !ok1 {
		return cpuCached
	}
	time.Sleep(200 * time.Millisecond)
	idle2, total2, ok2 := readCpuStat()
	if !ok2 {
		return cpuCached
	}
	idleDelta := float64(idle2 - idle1)
	totalDelta := float64(total2 - total1)
	if totalDelta <= 0 {
		return cpuCached
	}
	cpuCached = (1.0 - idleDelta/totalDelta) * 100
	cpuCachedAt = time.Now()
	return cpuCached
}
