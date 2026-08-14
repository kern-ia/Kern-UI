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

func TestCerveauWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := getDocuments(t, h, "/api/v1/cerveau")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestCerveauRejectsAMalformedFrom(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("kern-memory should never be called for a malformed from")
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := getDocuments(t, h, "/api/v1/cerveau?from=pasdedeuxpoints")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestCerveauBuildsAGraphFromRealRoots(t *testing.T) {
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q memory.MemoryQuery
		_ = json.NewDecoder(r.Body).Decode(&q)
		switch {
		case len(q.Tags) == 1 && q.Tags[0] == "cerveau-racine":
			_ = json.NewEncoder(w).Encode([]memory.Recall{
				{Memory: memory.Memory{ID: "root-1", Kind: "okf", Text: "Idée produit"}, Similarity: 1},
			})
		case q.Kind == "graph":
			_ = json.NewEncoder(w).Encode([]memory.Recall{})
		case q.Kind == "okf" && len(q.IDs) == 1 && q.IDs[0] == "root-1":
			_ = json.NewEncoder(w).Encode([]memory.Recall{
				{Memory: memory.Memory{ID: "root-1", Kind: "okf", Text: "Idée produit"}, Similarity: 1},
			})
		default:
			_ = json.NewEncoder(w).Encode([]memory.Recall{})
		}
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := getDocuments(t, h, "/api/v1/cerveau")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out memory.Cerveau
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out.Nodes) != 1 || out.Nodes[0].ID != "okf:root-1" || out.Nodes[0].Label != "Idée produit" {
		t.Errorf("got %+v", out)
	}
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

func TestListingCriteriaWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := getDocuments(t, h, "/api/v1/criteria")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestListingCriteriaProxiesTheOKFLayerOnly(t *testing.T) {
	var gotBody map[string]any
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode([]memory.Recall{
			{Memory: memory.Memory{ID: "c1", Kind: "okf", Text: "Taux d'usure T3 2026 : 5,92%"}, Similarity: 1},
		})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := getDocuments(t, h, "/api/v1/criteria")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	if gotBody["kind"] != "okf" {
		t.Errorf("query kind = %v, want okf — the vector layer has no lookup key to list by", gotBody["kind"])
	}
	var out []memory.Recall
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out) != 1 || out[0].Memory.ID != "c1" {
		t.Errorf("got %v", out)
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
