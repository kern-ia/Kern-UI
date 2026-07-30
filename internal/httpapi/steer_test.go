package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/steer"
)

func postJSON(t *testing.T, h http.Handler, path string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

func TestStoppingWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := postJSON(t, h, "/api/v1/runs/r1/stop", []byte(`{}`))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestStoppingARun(t *testing.T) {
	var gotPath, gotActor string
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		var body struct {
			Actor string `json:"actor"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotActor = body.Actor
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "stopping"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/r1/stop", []byte(`{}`))

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202: %s", rec.Code, rec.Body)
	}
	if gotPath != "/api/v1/runs/r1/stop" {
		t.Errorf("kern-orch path = %q", gotPath)
	}
	// No accounts configured: the session is open, and the actor is the empty string —
	// never something the request body could have claimed to be.
	if gotActor != "" {
		t.Errorf("actor = %q, want empty (no session configured)", gotActor)
	}
}

func TestStoppingSomeoneElsesRunIs403(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/r1/stop", []byte(`{}`))

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestStoppingAnUnknownRunIs404(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/jamais/stop", []byte(`{}`))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestNudgingARun(t *testing.T) {
	var gotBody struct {
		Key   string `json:"key"`
		Value any    `json:"value"`
	}
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/r1/nudge", []byte(`{"key":"message","value":"bonjour"}`))

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202: %s", rec.Code, rec.Body)
	}
	if gotBody.Key != "message" || gotBody.Value != "bonjour" {
		t.Errorf("got %+v", gotBody)
	}
}

func TestNudgingSurfacesAValidationFailure(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "key is required"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/r1/nudge", []byte(`{}`))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400: %s", rec.Code, rec.Body)
	}
}

func TestDecidingAnApprovalNode(t *testing.T) {
	var gotPath string
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "decided"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/runs/r1/nodes/confirm/decide", []byte(`{"decision":"approve"}`))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	if gotPath != "/api/v1/runs/r1/nodes/confirm/decide" {
		t.Errorf("kern-orch path = %q", gotPath)
	}
}

func TestDispatchingWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := postJSON(t, h, "/api/v1/dispatch", []byte(`{"skill":"heartbeat"}`))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestDispatchingATool(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(steer.DispatchResult{Kind: "tool", Result: &steer.ToolResult{Label: "Battement", Value: "17:09"}})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/dispatch", []byte(`{"skill":"heartbeat","text":""}`))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out steer.DispatchResult
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Kind != "tool" || out.Result == nil || out.Result.Value != "17:09" {
		t.Errorf("got %+v", out)
	}
}

func TestDispatchingAnUnknownSkillIs404WithTheKnownNames(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "unknown skill", "known": []string{"heartbeat", "planner"}})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/dispatch", []byte(`{"skill":"jamais"}`))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404: %s", rec.Code, rec.Body)
	}
	var out struct {
		Known []string `json:"known"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out.Known) != 2 {
		t.Errorf("known = %v, want the two real skill names", out.Known)
	}
}

func TestDispatchingRejectsAnEmptySkillName(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("kern-orch should never be called for an empty skill name")
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/dispatch", []byte(`{"skill":""}`))

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}
