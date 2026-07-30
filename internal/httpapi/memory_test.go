package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/memory"
)

func getDocuments(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func resolveSuggestion(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, nil))
	return rec
}

func TestListingDocumentsWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := getDocuments(t, h, "/api/v1/documents")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestListingDocumentsProxiesTheCatalogue(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer un-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode([]memory.Summary{{ID: "doc1", Title: "Compte-rendu"}})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL, Token: "un-secret"}})
	rec := getDocuments(t, h, "/api/v1/documents")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out []memory.Summary
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out) != 1 || out[0].ID != "doc1" {
		t.Errorf("got %v", out)
	}
}

func TestGettingADocumentWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := getDocuments(t, h, "/api/v1/documents/doc1")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestGettingAnUnknownDocumentIs404(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := getDocuments(t, h, "/api/v1/documents/jamais")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestGettingADocumentReturnsItsSuggestions(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/documents/doc1" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(memory.Document{
			ID: "doc1", Title: "Compte-rendu",
			Suggestions: []memory.Suggestion{{ID: "s1", Status: "pending"}},
		})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := getDocuments(t, h, "/api/v1/documents/doc1")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out memory.Document
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out.Suggestions) != 1 || out.Suggestions[0].ID != "s1" {
		t.Errorf("got %+v", out)
	}
}

func TestAcceptingASuggestionProxiesTheAcceptEndpoint(t *testing.T) {
	var gotPath string
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := resolveSuggestion(t, h, "/api/v1/documents/doc1/suggestions/s1/accept")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	if gotPath != "/api/v1/documents/doc1/suggestions/s1/accept" {
		t.Errorf("path = %q", gotPath)
	}
}

func TestIgnoringAnUnknownSuggestionIs404(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unknown suggestion"})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := resolveSuggestion(t, h, "/api/v1/documents/doc1/suggestions/nope/ignore")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}
