package firewall

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBudgetSendsTheBearerTokenAndDecodesTheSnapshot(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(Budget{
			SpentMicros: 18000, LimitMicros: 1_000_000,
			UnpricedCalls: 1, UnaccountedCalls: 0,
			WindowResetsAt: "2026-08-05T00:00:00Z",
		})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "un-jeton"}
	got, err := c.Budget(context.Background())
	if err != nil {
		t.Fatalf("Budget: %v", err)
	}
	if gotPath != "/v1/budget" {
		t.Errorf("path = %q", gotPath)
	}
	if gotAuth != "Bearer un-jeton" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if got.SpentMicros != 18000 || got.LimitMicros != 1_000_000 {
		t.Errorf("got %+v", got)
	}
}

func TestBudgetSurfacesAnUpstreamFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if _, err := c.Budget(context.Background()); err == nil {
		t.Fatal("Budget succeeded against a 500")
	}
}

func TestBudgetOmitsTheAuthorizationHeaderWithNoToken(t *testing.T) {
	var gotAuth string
	seen := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		seen = true
		_ = json.NewEncoder(w).Encode(Budget{})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if _, err := c.Budget(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !seen {
		t.Fatal("request never reached the server")
	}
	if gotAuth != "" {
		t.Errorf("Authorization = %q, want none set", gotAuth)
	}
}

func TestEnabledIsFalseWithNoBaseURL(t *testing.T) {
	var c *Client
	if c.Enabled() {
		t.Error("a nil Client reported Enabled")
	}
	c = &Client{}
	if c.Enabled() {
		t.Error("a Client with no BaseURL reported Enabled")
	}
}

func TestEnabledIsTrueWithABaseURL(t *testing.T) {
	c := &Client{BaseURL: "http://127.0.0.1:8443"}
	if !c.Enabled() {
		t.Error("a Client with a BaseURL reported not Enabled")
	}
}
