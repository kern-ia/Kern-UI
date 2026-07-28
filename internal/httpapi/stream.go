package httpapi

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// handleStream streams run changes to one browser as Server-Sent Events.
//
// The connection opens with a full snapshot, then carries incremental updates. That order
// matters twice: it lets a browser render immediately, and it makes the hub's drop policy
// survivable — a client that fell behind reconnects and gets a fresh snapshot.
func (s *server) handleStream(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)

	// Subscribe before reading the snapshot: the reverse order would silently lose every
	// change landing between the two.
	updates, unsubscribe := s.cfg.Hub.Subscribe()
	defer unsubscribe()

	snapshot := s.cfg.Runs.List()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	// Proxies that buffer responses would defeat the whole point of streaming.
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	if !writeEvent(w, rc, "snapshot", snapshot) {
		return
	}

	heartbeat := time.NewTicker(s.cfg.Heartbeat)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return

		case run, open := <-updates:
			if !open {
				return
			}
			if !writeEvent(w, rc, "run", run) {
				return
			}

		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			if err := rc.Flush(); err != nil {
				return
			}
		}
	}
}

// writeEvent emits one SSE frame and flushes it. It reports whether the connection is
// still usable.
func writeEvent(w http.ResponseWriter, rc *http.ResponseController, name string, payload any) bool {
	data, err := json.Marshal(payload)
	if err != nil {
		slog.Error("encode sse payload", "event", name, "error", err)
		return false
	}

	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", name, data); err != nil {
		return false
	}
	return rc.Flush() == nil
}
