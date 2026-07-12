package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: checkWsOrigin,
}

func checkWsOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}
	allowed := envOr("WEBINO_WS_ALLOWED_ORIGINS", "")
	if allowed != "" {
		for _, o := range strings.Split(allowed, ",") {
			if strings.TrimSpace(o) == origin {
				return true
			}
		}
		return false
	}
	host := r.Host
	if host == "" {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	originHost := u.Hostname()
	requestHost := host
	if h, _, err := net.SplitHostPort(host); err == nil {
		requestHost = h
	}
	if originHost == requestHost {
		return true
	}
	return false
}

type ticketPayload struct {
	Exp int64 `json:"exp"`
	UID int64 `json:"uid"`
}

func startWebSocketServer(addr string) {
	if addr == "" {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleTerminalWS)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Printf("websocket listen failed: %v", err)
		return
	}
	log.Printf("webino-agent websocket listening on %s", addr)
	go func() {
		if err := http.Serve(ln, mux); err != nil {
			log.Printf("websocket server stopped: %v", err)
		}
	}()
}

func handleTerminalWS(w http.ResponseWriter, r *http.Request) {
	ticket := r.URL.Query().Get("ticket")
	uid, err := verifyTicket(ticket)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	_ = uid

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	cmd := exec.Command("bash", "-l")
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell\r\n"))
		return
	}
	defer func() {
		_ = ptmx.Close()
		_ = cmd.Process.Kill()
	}()

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		buf := make([]byte, 4096)
		for {
			n, readErr := ptmx.Read(buf)
			if n > 0 {
				if writeErr := conn.WriteMessage(websocket.TextMessage, buf[:n]); writeErr != nil {
					return
				}
			}
			if readErr != nil {
				return
			}
		}
	}()

	go func() {
		defer wg.Done()
		for {
			mt, message, readErr := conn.ReadMessage()
			if readErr != nil {
				return
			}
			if mt == websocket.TextMessage && len(message) > 0 && message[0] == '{' {
				var ctrl struct {
					Type string `json:"type"`
					Cols int    `json:"cols"`
					Rows int    `json:"rows"`
				}
				if json.Unmarshal(message, &ctrl) == nil && ctrl.Type == "resize" && ctrl.Cols > 0 && ctrl.Rows > 0 {
					_ = pty.Setsize(ptmx, &pty.Winsize{Cols: uint16(ctrl.Cols), Rows: uint16(ctrl.Rows)})
					continue
				}
			}
			if _, writeErr := ptmx.Write(message); writeErr != nil {
				return
			}
		}
	}()

	wg.Wait()
}

func verifyTicket(ticket string) (int64, error) {
	if ticket == "" {
		return 0, errInvalidTicket
	}
	parts := strings.SplitN(ticket, ".", 2)
	if len(parts) != 2 {
		return 0, errInvalidTicket
	}
	payloadB64, sigHex := parts[0], parts[1]
	if sharedToken == "" {
		return 0, errInvalidTicket
	}
	mac := hmac.New(sha256.New, []byte(sharedToken))
	mac.Write([]byte(payloadB64))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sigHex)) {
		return 0, errInvalidTicket
	}
	raw, err := base64.StdEncoding.DecodeString(payloadB64)
	if err != nil {
		return 0, errInvalidTicket
	}
	var payload ticketPayload
	if json.Unmarshal(raw, &payload) != nil {
		return 0, errInvalidTicket
	}
	if payload.Exp < time.Now().Unix() {
		return 0, errInvalidTicket
	}
	return payload.UID, nil
}

var errInvalidTicket = invalidTicketError{}

type invalidTicketError struct{}

func (invalidTicketError) Error() string { return "invalid ticket" }
