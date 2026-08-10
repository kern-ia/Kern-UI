package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/tools"
)

func getTools(t *testing.T, h http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/tools", nil))
	return rec
}

func invokeTool(t *testing.T, h http.Handler, name string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tools/"+name+"/invoke", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

// No BaseURL configured reads the same as C4's unpublished registry: a caller has to be
// able to tell "nothing is wired to answer this" from "kern-orch has no such tool".
func TestListingToolsWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := getTools(t, h)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestListingToolsProxiesTheCatalogue(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer un-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode([]tools.Spec{{Name: "heartbeat"}})
	}))
	defer orch.Close()

	h := NewRouter(Config{Tools: &tools.Client{BaseURL: orch.URL, Token: "un-secret"}})
	rec := getTools(t, h)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out []tools.Spec
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out) != 1 || out[0].Name != "heartbeat" {
		t.Errorf("got %v", out)
	}
}

func TestListingToolsSurfacesAnUnreachableSource(t *testing.T) {
	h := NewRouter(Config{Tools: &tools.Client{BaseURL: "http://127.0.0.1:0"}})
	rec := getTools(t, h)
	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", rec.Code)
	}
}

func TestInvokingWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := invokeTool(t, h, "heartbeat", []byte(`{}`))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestInvokingATool(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/tools/greeting/invoke" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(tools.Result{Label: "Salutation", Value: "Bonjour, Yoann !"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Tools: &tools.Client{BaseURL: orch.URL}})
	rec := invokeTool(t, h, "greeting", []byte(`{"input":{"name":"Yoann"}}`))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out tools.Result
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Label != "Salutation" || out.Value != "Bonjour, Yoann !" {
		t.Errorf("got %+v", out)
	}
}

func TestInvokingAnUnknownToolIs404(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer orch.Close()

	h := NewRouter(Config{Tools: &tools.Client{BaseURL: orch.URL}})
	rec := invokeTool(t, h, "jamais", []byte(`{}`))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestInvokingASkillWithAMissingParamSurfacesTheReason(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing required param \"name\""})
	}))
	defer orch.Close()

	h := NewRouter(Config{Tools: &tools.Client{BaseURL: orch.URL}})
	rec := invokeTool(t, h, "greeting", []byte(`{}`))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400: %s", rec.Code, rec.Body)
	}
}
