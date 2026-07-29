package tools

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListSendsTheBearerTokenAndDecodesTheCatalogue(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode([]Spec{{Name: "heartbeat", Description: "reports the time"}})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "un-jeton"}
	specs, err := c.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if gotPath != "/api/v1/tools" {
		t.Errorf("path = %q", gotPath)
	}
	if gotAuth != "Bearer un-jeton" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if len(specs) != 1 || specs[0].Name != "heartbeat" {
		t.Errorf("got %+v", specs)
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

func TestInvokePostsTheInputAndDecodesTheResult(t *testing.T) {
	var gotPath, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		buf := make([]byte, 256)
		n, _ := r.Body.Read(buf)
		gotBody = string(buf[:n])
		_ = json.NewEncoder(w).Encode(Result{Label: "Salutation", Value: "Bonjour, Yoann !"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "x"}
	res, err := c.Invoke(context.Background(), "greeting", map[string]any{"name": "Yoann"})
	if err != nil {
		t.Fatalf("Invoke: %v", err)
	}
	if gotPath != "/api/v1/tools/greeting/invoke" {
		t.Errorf("path = %q", gotPath)
	}
	if gotBody == "" {
		t.Fatal("no body sent")
	}
	if res.Label != "Salutation" || res.Value != "Bonjour, Yoann !" {
		t.Errorf("got %+v", res)
	}
}

// kern-orch answers 404 for an unknown tool name — Invoke turns that into ErrUnknownTool
// rather than a generic error string, so a caller can map it to its own 404 without
// parsing text.
func TestInvokeMapsA404ToErrUnknownTool(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	_, err := c.Invoke(context.Background(), "jamais", nil)
	if err == nil {
		t.Fatal("Invoke succeeded against a 404")
	}
	if err != ErrUnknownTool {
		t.Errorf("err = %v, want ErrUnknownTool", err)
	}
}

// A validation failure (missing required param) travels as kern-orch's own message, not a
// generic "bad gateway" — the reader deserves to know what to fix.
func TestInvokeCarriesTheUpstreamErrorMessage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing required param \"name\""})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	_, err := c.Invoke(context.Background(), "greeting", nil)
	if err == nil || err.Error() != "missing required param \"name\"" {
		t.Errorf("err = %v", err)
	}
	var invalid *InvalidInputError
	if !errors.As(err, &invalid) {
		t.Errorf("err = %T, want *InvalidInputError — a caller maps this to 400, not 502", err)
	}
}

// A 5xx from kern-orch is kern-orch's own trouble, not something the caller's input can
// fix — it must not come back as an InvalidInputError.
func TestInvokeDoesNotTreatAServerErrorAsInvalidInput(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	_, err := c.Invoke(context.Background(), "greeting", nil)
	var invalid *InvalidInputError
	if errors.As(err, &invalid) {
		t.Error("a 500 was classified as InvalidInputError")
	}
	if err == nil {
		t.Fatal("Invoke succeeded against a 500")
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
