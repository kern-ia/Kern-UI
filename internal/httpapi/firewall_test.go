package httpapi

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/yoann/kern-ui/internal/firewall"
)

// No BaseURL configured reads the same as the tools catalogue's 404: a caller must be
// able to tell "nothing is wired to answer this" from "the firewall answered with a real,
// if empty, snapshot".
func TestFirewallBudgetWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/vigie/budget", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestFirewallBudgetProxiesTheSnapshot(t *testing.T) {
	fw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer un-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(firewall.Budget{SpentMicros: 18000, LimitMicros: 1_000_000})
	}))
	defer fw.Close()

	h := NewRouter(Config{Firewall: &firewall.Client{BaseURL: fw.URL, Token: "un-secret"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/vigie/budget", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	var got firewall.Budget
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SpentMicros != 18000 {
		t.Errorf("SpentMicros = %d", got.SpentMicros)
	}
}

func TestFirewallBudgetSurfacesAnUpstreamFailure(t *testing.T) {
	fw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer fw.Close()

	h := NewRouter(Config{Firewall: &firewall.Client{BaseURL: fw.URL}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/vigie/budget", nil))
	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", rec.Code)
	}
}

func TestFirewallDecisionsWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/vigie/decisions", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// The whole point of the endpoint: a decision published on the hub after a browser
// connects must reach it as a named SSE event — no snapshot first, unlike /api/v1/stream,
// since a decision has no "current state" to summarise on connect.
func TestFirewallDecisionsStreamsAPublishedDecision(t *testing.T) {
	cfg := Config{Firewall: &firewall.Client{BaseURL: "http://127.0.0.1:0"}}
	h := NewRouterWithDeps(&cfg)
	srv := httptest.NewServer(h)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/vigie/decisions", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("Content-Type = %q, want text/event-stream", ct)
	}

	// Give the handler a moment to reach Subscribe before publishing, or the
	// decision would be published to nobody.
	deadline := time.Now().Add(2 * time.Second)
	for cfg.DecisionsHub.Subscribers() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("handler never subscribed")
		}
		time.Sleep(5 * time.Millisecond)
	}

	cfg.DecisionsHub.Publish(firewall.Decision{Rule: "too-many", RunID: "r1"})

	name, data := readSSEFrame(t, bufio.NewReader(resp.Body))
	if name != "decision" {
		t.Fatalf("event = %q, want %q", name, "decision")
	}
	var got firewall.Decision
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if got.Rule != "too-many" || got.RunID != "r1" {
		t.Errorf("decision = %+v", got)
	}
}

func readSSEFrame(t *testing.T, r *bufio.Reader) (string, []byte) {
	t.Helper()
	var name string
	var data []byte
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			t.Fatalf("read frame: %v", err)
		}
		line = strings.TrimRight(line, "\r\n")
		switch {
		case line == "" && name != "":
			return name, data
		case strings.HasPrefix(line, ":"), line == "":
			continue
		case strings.HasPrefix(line, "event:"):
			name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			data = []byte(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
}
