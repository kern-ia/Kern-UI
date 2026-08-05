package httpapi

import (
	"fmt"
	"net/http"
	"time"
)

// handleFirewallBudget proxies the AI firewall's consumption snapshot for Vigie.
// Unconfigured reads as 404, same reasoning as handleListTools: "nothing answers
// this" must be a fact the browser can tell apart from the firewall answering
// with a real, if empty, snapshot.
func (s *server) handleFirewallBudget(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Firewall.Enabled() {
		writeError(w, http.StatusNotFound, "no firewall source configured")
		return
	}
	budget, err := s.cfg.Firewall.Budget(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, budget)
}

// handleFirewallDecisions streams behavioural decisions to one browser as
// Server-Sent Events.
//
// Unlike handleStream, this opens with no snapshot: a decision has no
// "current state" to summarise on connect the way a run does — it is a
// transient event, gone the moment it is missed, not a value with a
// queryable present. A browser that connects mid-session simply starts
// seeing decisions from that point forward.
func (s *server) handleFirewallDecisions(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Firewall.Enabled() {
		writeError(w, http.StatusNotFound, "no firewall source configured")
		return
	}

	rc := http.NewResponseController(w)

	decisions, unsubscribe := s.cfg.DecisionsHub.Subscribe()
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if err := rc.Flush(); err != nil {
		return
	}

	heartbeat := time.NewTicker(s.cfg.Heartbeat)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return

		case d, open := <-decisions:
			if !open {
				return
			}
			if !writeEvent(w, rc, "decision", d) {
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
