package httpapi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/yoann/kern-ui/internal/projection"
)

func stepBody(step int, frontier ...string) string {
	if frontier == nil {
		frontier = []string{}
	}
	f, _ := json.Marshal(frontier)
	return fmt.Sprintf(
		`{"graph":"review","step":%d,"frontier":%s,"state":{"k":"v"},"at":"2026-07-26T12:00:0%dZ"}`,
		step, f, step,
	)
}

func postStep(t *testing.T, h http.Handler, runID, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/runs/"+runID+"/steps", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

func TestIngestAcceptsAStepAndExposesTheRun(t *testing.T) {
	h := NewRouter(Config{})

	if rec := postStep(t, h, "r1", stepBody(1, "analyse")); rec.Code != http.StatusAccepted {
		t.Fatalf("POST status = %d, want %d (body %s)", rec.Code, http.StatusAccepted, rec.Body)
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", rec.Code, http.StatusOK)
	}

	var runs []projection.Run
	if err := json.NewDecoder(rec.Body).Decode(&runs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("len(runs) = %d, want 1", len(runs))
	}
	if runs[0].ID != "r1" || runs[0].Status != projection.StatusRunning {
		t.Errorf("run = %+v, want id r1 running", runs[0])
	}
}

func TestIngestTakesTheRunIDFromThePath(t *testing.T) {
	h := NewRouter(Config{})
	postStep(t, h, "from-path", stepBody(1, "analyse"))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/from-path", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestIngestRejectsARunIDThatContradictsThePath(t *testing.T) {
	h := NewRouter(Config{})
	body := `{"run_id":"other","graph":"review","step":1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`

	if rec := postStep(t, h, "r1", body); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestIngestRejectsAnInvalidEvent(t *testing.T) {
	h := NewRouter(Config{})
	cases := map[string]string{
		"malformed json": `{`,
		"missing graph":  `{"step":1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`,
		"negative step":  `{"graph":"g","step":-1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`,
		"missing at":     `{"graph":"g","step":1,"frontier":["a"]}`,
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if rec := postStep(t, h, "r1", body); rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestIngestIsIdempotent(t *testing.T) {
	h := NewRouter(Config{})
	body := stepBody(1, "analyse")

	postStep(t, h, "r1", body)
	if rec := postStep(t, h, "r1", body); rec.Code != http.StatusAccepted {
		t.Errorf("replay status = %d, want %d", rec.Code, http.StatusAccepted)
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil))
	var runs []projection.Run
	_ = json.NewDecoder(rec.Body).Decode(&runs)
	if len(runs) != 1 {
		t.Errorf("len(runs) = %d, want 1 — a replay must not duplicate the run", len(runs))
	}
}

func TestUnknownRunIsNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	NewRouter(Config{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/ghost", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestStreamSendsASnapshotThenLiveUpdates(t *testing.T) {
	h := NewRouter(Config{})
	srv := httptest.NewServer(h)
	defer srv.Close()

	// A run already exists before anyone connects: it must arrive in the snapshot.
	postStep(t, h, "before", stepBody(1, "analyse"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/v1/stream", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("Content-Type = %q, want text/event-stream", ct)
	}

	reader := bufio.NewReader(resp.Body)

	name, data := readEvent(t, reader)
	if name != "snapshot" {
		t.Fatalf("first event = %q, want %q", name, "snapshot")
	}
	var snapshot []projection.Run
	if err := json.Unmarshal(data, &snapshot); err != nil {
		t.Fatalf("decode snapshot: %v", err)
	}
	if len(snapshot) != 1 || snapshot[0].ID != "before" {
		t.Fatalf("snapshot = %+v, want the run created before connecting", snapshot)
	}

	postStep(t, h, "after", stepBody(1, "synthese"))

	name, data = readEvent(t, reader)
	if name != "run" {
		t.Fatalf("second event = %q, want %q", name, "run")
	}
	var run projection.Run
	if err := json.Unmarshal(data, &run); err != nil {
		t.Fatalf("decode run: %v", err)
	}
	if run.ID != "after" {
		t.Errorf("run.ID = %q, want %q", run.ID, "after")
	}
}

func TestStreamReleasesItsSubscriptionWhenTheClientLeaves(t *testing.T) {
	cfg := Config{}
	h := NewRouterWithDeps(&cfg)
	srv := httptest.NewServer(h)
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/v1/stream", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	readEvent(t, bufio.NewReader(resp.Body)) // wait until the handler is subscribed

	if got := cfg.Hub.Subscribers(); got != 1 {
		t.Fatalf("Subscribers() = %d, want 1", got)
	}

	cancel()
	resp.Body.Close()

	deadline := time.Now().Add(2 * time.Second)
	for cfg.Hub.Subscribers() != 0 {
		if time.Now().After(deadline) {
			t.Fatal("the subscription leaked after the client disconnected")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// readEvent reads one SSE frame and returns its event name and data payload.
func readEvent(t *testing.T, r *bufio.Reader) (string, []byte) {
	t.Helper()

	var name string
	var data bytes.Buffer

	for {
		line, err := r.ReadString('\n')
		if err != nil {
			t.Fatalf("read frame: %v", err)
		}
		line = strings.TrimRight(line, "\r\n")

		switch {
		case line == "" && name != "":
			return name, data.Bytes()
		case strings.HasPrefix(line, ":"), line == "":
			continue // heartbeat or padding
		case strings.HasPrefix(line, "event:"):
			name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			data.WriteString(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
}

func TestCollectionEndpointTakesTheRunIDFromTheBody(t *testing.T) {
	h := NewRouter(Config{})
	body := `{"run_id":"r1","graph":"review","step":1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d (body %s)", rec.Code, http.StatusAccepted, rec.Body)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/r1", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("the run was not recorded: status = %d", rec.Code)
	}
}

func TestCollectionEndpointRequiresARunID(t *testing.T) {
	h := NewRouter(Config{})
	body := `{"graph":"review","step":1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCollectionEndpointPublishesToTheStream(t *testing.T) {
	cfg := Config{}
	h := NewRouterWithDeps(&cfg)

	sub, unsubscribe := cfg.Hub.Subscribe()
	defer unsubscribe()

	body := `{"run_id":"r1","graph":"review","step":1,"frontier":["a"],"at":"2026-07-26T12:00:00Z"}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", strings.NewReader(body))
	h.ServeHTTP(rec, req)

	select {
	case run := <-sub:
		if run.ID != "r1" {
			t.Errorf("published run = %q, want %q", run.ID, "r1")
		}
	case <-time.After(time.Second):
		t.Error("nothing was published to the stream")
	}
}
