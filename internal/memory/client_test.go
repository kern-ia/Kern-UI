package memory

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListSendsTheBearerTokenAndDecodesTheCatalogue(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode([]Summary{{ID: "doc1", Title: "Compte-rendu", WordCount: 3}})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "un-jeton"}
	list, err := c.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if gotPath != "/api/v1/documents" {
		t.Errorf("path = %q", gotPath)
	}
	if gotAuth != "Bearer un-jeton" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if len(list) != 1 || list[0].ID != "doc1" {
		t.Errorf("got %+v", list)
	}
}

func TestListSurfacesAnUpstreamFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if _, err := c.List(context.Background()); err == nil {
		t.Fatal("List succeeded against a 500")
	}
}

func TestGetDecodesTheDocumentWithItsSuggestions(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(Document{
			ID: "doc1", Title: "Compte-rendu", Body: "un deux trois", WordCount: 3,
			Suggestions: []Suggestion{{ID: "s1", Text: "x", Status: "pending"}},
		})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	doc, err := c.Get(context.Background(), "doc1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if gotPath != "/api/v1/documents/doc1" {
		t.Errorf("path = %q", gotPath)
	}
	if len(doc.Suggestions) != 1 || doc.Suggestions[0].ID != "s1" {
		t.Errorf("got %+v", doc)
	}
}

func TestGetMapsA404ToErrUnknownDocument(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	_, err := c.Get(context.Background(), "jamais")
	if err != ErrUnknownDocument {
		t.Errorf("err = %v, want ErrUnknownDocument", err)
	}
}

func TestResolvePostsToTheAcceptOrIgnoreEndpoint(t *testing.T) {
	var gotPath, gotMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Resolve(context.Background(), "doc1", "s1", true); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if gotPath != "/api/v1/documents/doc1/suggestions/s1/accept" || gotMethod != http.MethodPost {
		t.Errorf("path=%q method=%q", gotPath, gotMethod)
	}
}

func TestResolveIgnoreUsesTheIgnoreEndpoint(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Resolve(context.Background(), "doc1", "s1", false); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if gotPath != "/api/v1/documents/doc1/suggestions/s1/ignore" {
		t.Errorf("path = %q", gotPath)
	}
}

func TestResolveDistinguishesUnknownDocumentFromUnknownSuggestion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unknown suggestion"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	err := c.Resolve(context.Background(), "doc1", "nope", true)
	if err != ErrUnknownSuggestion {
		t.Errorf("err = %v, want ErrUnknownSuggestion", err)
	}
}

func TestEnabledReflectsWhetherABaseURLIsConfigured(t *testing.T) {
	if (&Client{}).Enabled() {
		t.Error("Enabled() true with no BaseURL")
	}
	if !(&Client{BaseURL: "http://x"}).Enabled() {
		t.Error("Enabled() false with a BaseURL set")
	}
}
