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

func TestWriteMemoryPostsToTheMemoryWriteEndpoint(t *testing.T) {
	var gotPath, gotAuth string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(Memory{ID: "item-1", Kind: "okf", Text: "contenu"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "tok"}
	out, err := c.WriteMemory(context.Background(), Memory{
		ID: "item-1", Kind: "okf", Text: "contenu", Tags: []string{"marketing"},
	})
	if err != nil {
		t.Fatalf("WriteMemory: %v", err)
	}
	if gotPath != "/api/v1/memory/write" {
		t.Errorf("path = %q", gotPath)
	}
	if gotAuth != "Bearer tok" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if gotBody["id"] != "item-1" || gotBody["kind"] != "okf" {
		t.Errorf("body = %+v", gotBody)
	}
	if out.ID != "item-1" {
		t.Errorf("got %+v", out)
	}
}

func TestWriteMemorySurfacesAnUpstreamFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if _, err := c.WriteMemory(context.Background(), Memory{Text: "x"}); err == nil {
		t.Fatal("WriteMemory succeeded against a 500")
	}
}

func TestQueryMemoryPostsTheQueryAndDecodesRecalls(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode([]Recall{
			{Memory: Memory{ID: "item-1", Text: "contenu"}, Similarity: 1},
		})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	got, err := c.QueryMemory(context.Background(), MemoryQuery{Kind: "okf", Tags: []string{"marketing"}})
	if err != nil {
		t.Fatalf("QueryMemory: %v", err)
	}
	if gotPath != "/api/v1/memory/query" {
		t.Errorf("path = %q", gotPath)
	}
	if gotBody["kind"] != "okf" {
		t.Errorf("body = %+v", gotBody)
	}
	if len(got) != 1 || got[0].Memory.ID != "item-1" {
		t.Errorf("got %+v", got)
	}
}

func TestQueryMemorySurfacesAnUpstreamFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if _, err := c.QueryMemory(context.Background(), MemoryQuery{}); err == nil {
		t.Fatal("QueryMemory succeeded against a 500")
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
