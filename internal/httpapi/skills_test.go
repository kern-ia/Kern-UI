package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/auth"
	"github.com/yoann/kern-ui/internal/steer"
)

// guardedWithSteer is guarded(t) (auth_test.go) plus a Steer source — the shape a real
// deployment has both of.
func guardedWithSteer(t *testing.T, steerURL string) http.Handler {
	t.Helper()
	hash, err := auth.HashPassword(operatorPass)
	if err != nil {
		t.Fatal(err)
	}
	accounts, err := auth.LoadAccountsFromLines([]string{operatorName + ":" + hash})
	if err != nil {
		t.Fatal(err)
	}
	return NewRouter(Config{
		ProducerToken: producerToken,
		Accounts:      accounts,
		Steer:         &steer.Client{BaseURL: steerURL},
	})
}

func TestCreatingASkillWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := postJSON(t, h, "/api/v1/skills", []byte(`{"name":"accueil","steps":[{"name":"a","instructions":"b"}]}`))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// The actor kern-orch receives comes from the session, never the body — same rule as
// every other steer endpoint. guarded(t)/login(t, h) log in as operatorName.
func TestCreatingASkillSendsTheSessionActorNeverTheBody(t *testing.T) {
	var gotActor string
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Actor string `json:"actor"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotActor = body.Actor
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(steer.CreatedSkill{Name: "accueil", CreatedBy: operatorName, Custom: true})
	}))
	defer orch.Close()

	h := guardedWithSteer(t, orch.URL)
	cookie := login(t, h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/skills",
		bytes.NewReader([]byte(`{"name":"accueil","actor":"quelquun-dautre","steps":[{"name":"a","instructions":"b"}]}`)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body)
	}
	if gotActor != operatorName {
		t.Errorf("actor sent to kern-orch = %q, want the session's own %q", gotActor, operatorName)
	}
}

func TestCreatingASkillRejectsAnEmptyName(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("kern-orch should never be called for an empty name")
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/skills", []byte(`{"name":"","steps":[{"name":"a","instructions":"b"}]}`))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestCreatingASkillRejectsNoSteps(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("kern-orch should never be called with no steps")
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/skills", []byte(`{"name":"accueil","steps":[]}`))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestCreatingASkillSurfacesANameAlreadyTaken(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": `skills: "accueil" already exists`})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := postJSON(t, h, "/api/v1/skills", []byte(`{"name":"accueil","steps":[{"name":"a","instructions":"b"}]}`))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body)
	}
}

func TestDeletingASkillSendsTheSessionActor(t *testing.T) {
	var gotActor, gotMethod, gotPath string
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		var body struct {
			Actor string `json:"actor"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotActor = body.Actor
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}))
	defer orch.Close()

	h := guardedWithSteer(t, orch.URL)
	cookie := login(t, h)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/skills/accueil", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	if gotMethod != http.MethodDelete || gotPath != "/api/v1/skills/accueil" {
		t.Errorf("method/path = %s %s", gotMethod, gotPath)
	}
	if gotActor != operatorName {
		t.Errorf("actor = %q, want %q", gotActor, operatorName)
	}
}

func TestDeletingASkillMapsForbiddenTo403WithTheRightMessage(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/skills/accueil", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}
