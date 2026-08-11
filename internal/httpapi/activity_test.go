package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/yoann/kern-ui/internal/projection"
)

// contractActivity is the canonical kern.activity/v1 payload. The identical file lives in
// Kern-Orch/contracts/, where a mirror test asserts its reporter emits exactly this.
const contractActivity = "../../contracts/kern.activity.v1.json"

func postActivity(t *testing.T, h http.Handler, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/activity", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

func TestActivityContractFixtureIsAccepted(t *testing.T) {
	h := NewRouter(Config{})

	rec := postActivity(t, h, readFile(t, contractActivity))

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d — the contract fixture was rejected: %s",
			rec.Code, http.StatusAccepted, rec.Body)
	}
}

// The fixture is the contract: it must itself satisfy the schema we publish.
func TestActivityFixtureMatchesThePublishedSchema(t *testing.T) {
	var ev projection.ActivityEvent
	dec := json.NewDecoder(bytes.NewReader(readFile(t, contractActivity)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&ev); err != nil {
		t.Fatalf("the fixture does not match projection.ActivityEvent: %v", err)
	}
	if err := ev.Validate(); err != nil {
		t.Errorf("the fixture fails our own validation: %v", err)
	}
}

// The signal reaches a browser through the run it belongs to, so it must be visible on the
// ordinary run endpoints and not only in the response body.
func TestActivityShowsOnTheRun(t *testing.T) {
	h := NewRouter(Config{})
	postActivity(t, h, readFile(t, contractActivity))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/a23ead5373d9b746", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("the run is unknown after an activity signal: status = %d", rec.Code)
	}

	var run projection.Run
	if err := json.NewDecoder(rec.Body).Decode(&run); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if run.Status != projection.StatusRunning {
		t.Errorf("Status = %q, want running", run.Status)
	}
	if !slices.Contains(run.Generating, "greet") {
		t.Errorf("Generating = %v, want greet", run.Generating)
	}
}

// A message reaches the run's own activity_log through the same ingestion route as the
// rest of the contract — no separate endpoint to keep in sync.
func TestActivityMessageShowsOnTheRunsActivityLog(t *testing.T) {
	h := NewRouter(Config{})
	body := `{"run_id":"r1","graph":"hello","node_id":"extraction","generating":false,` +
		`"at":"2026-07-26T12:00:01Z","message":"3 pages traitées."}`
	postActivity(t, h, []byte(body))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/r1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}

	var run projection.Run
	if err := json.NewDecoder(rec.Body).Decode(&run); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(run.ActivityLog) != 1 || run.ActivityLog[0].Message != "3 pages traitées." {
		t.Errorf("ActivityLog = %v, want the narrated message", run.ActivityLog)
	}
}

func TestActivityRejectsAnInvalidEvent(t *testing.T) {
	cases := map[string]string{
		"no node id":    `{"run_id":"r1","graph":"hello","generating":true,"at":"2026-07-26T12:00:01Z"}`,
		"no graph":      `{"run_id":"r1","node_id":"greet","generating":true,"at":"2026-07-26T12:00:01Z"}`,
		"unknown field": `{"run_id":"r1","graph":"g","node_id":"greet","generating":true,"at":"2026-07-26T12:00:01Z","tokens":42}`,
		"malformed":     `{`,
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			rec := postActivity(t, NewRouter(Config{}), []byte(body))
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}
