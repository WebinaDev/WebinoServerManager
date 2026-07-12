package main

import (
	"strings"
	"sync"
)

var execLocks sync.Map

func execLockKey(argv []string) string {
	if len(argv) == 0 {
		return ""
	}
	cmd := filepathBase(argv[0])
	switch cmd {
	case "nginx":
		return "nginx"
	case "pdnsutil", "pdns_control":
		return "pdns"
	case "pure-pw":
		return "pureftp"
	case "postmap", "postfix", "doveadm":
		if cmd == "doveadm" && len(argv) > 1 && argv[1] == "quota" {
			return ""
		}
		return "mailmaps"
	case "restic":
		return "restic"
	}
	if cmd == "systemctl" && len(argv) > 2 {
		unit := argv[2]
		if strings.Contains(unit, "nginx") {
			return "nginx"
		}
	}
	return ""
}

func acquireExecLock(key string) func() {
	if key == "" {
		return func() {}
	}
	val, _ := execLocks.LoadOrStore(key, &sync.Mutex{})
	mu := val.(*sync.Mutex)
	mu.Lock()
	return mu.Unlock
}

func filepathBase(path string) string {
	if i := strings.LastIndex(path, "/"); i >= 0 {
		return path[i+1:]
	}
	return path
}
