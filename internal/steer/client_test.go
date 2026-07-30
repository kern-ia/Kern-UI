package steer

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStopSendsTheActorAndTheToken(t *testing.T) {
	var gotAuth, gotPath, gotActor string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		var body struct {
			Actor string `json:"actor"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotActor = body.Actor
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "stopping"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL, Token: "un-jeton"}
	if err := c.Stop(context.Background(), "r1", "yoann"); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if gotPath != "/api/v1/runs/r1/stop" {
		t.Errorf("path = %q", gotPath)
	}
	if gotAuth != "Bearer un-jeton" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if gotActor != "yoann" {
		t.Errorf("actor = %q", gotActor)
	}
}

func TestStopMapsA404ToErrNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Stop(context.Background(), "jamais", ""); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestStopMapsA403ToErrForbidden(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Stop(context.Background(), "r1", "pas-le-demandeur"); !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v, want ErrForbidden", err)
	}
}

func TestNudgePostsTheKeyAndValue(t *testing.T) {
	var gotBody struct {
		Actor string `json:"actor"`
		Key   string `json:"key"`
		Value any    `json:"value"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Nudge(context.Background(), "r1", "yoann", "message", "bonjour"); err != nil {
		t.Fatalf("Nudge: %v", err)
	}
	if gotBody.Key != "message" || gotBody.Value != "bonjour" || gotBody.Actor != "yoann" {
		t.Errorf("got %+v", gotBody)
	}
}

func TestNudgeSurfacesAValidationFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "key is required"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	err := c.Nudge(context.Background(), "r1", "", "", "x")
	var invalid *InvalidInputError
	if !errors.As(err, &invalid) || invalid.Message != "key is required" {
		t.Errorf("err = %v, want *InvalidInputError(key is required)", err)
	}
}

func TestDecidePostsTheDecision(t *testing.T) {
	var gotPath string
	var gotBody struct {
		Actor    string `json:"actor"`
		Decision string `json:"decision"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "decided"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	if err := c.Decide(context.Background(), "r1", "confirm", "yoann", "approve"); err != nil {
		t.Fatalf("Decide: %v", err)
	}
	if gotPath != "/api/v1/runs/r1/nodes/confirm/decide" {
		t.Errorf("path = %q", gotPath)
	}
	if gotBody.Decision != "approve" || gotBody.Actor != "yoann" {
		t.Errorf("got %+v", gotBody)
	}
}

func TestDecideMapsA404ToErrNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	err := c.Decide(context.Background(), "r1", "jamais", "", "approve")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestDispatchInvokingAToolDecodesTheResult(t *testing.T) {
	var gotPath string
	var gotBody struct {
		Skill string `json:"skill"`
		Text  string `json:"text"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(DispatchResult{Kind: "tool", Result: &ToolResult{Label: "Battement", Value: "17:09"}})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	res, err := c.Dispatch(context.Background(), "heartbeat", "", "yoann")
	if err != nil {
		t.Fatalf("Dispatch: %v", err)
	}
	if gotPath != "/api/v1/dispatch" {
		t.Errorf("path = %q", gotPath)
	}
	if gotBody.Skill != "heartbeat" {
		t.Errorf("body = %+v", gotBody)
	}
	if res.Kind != "tool" || res.Result == nil || res.Result.Value != "17:09" {
		t.Errorf("got %+v", res)
	}
}

func TestDispatchLaunchingARunDecodesTheRunID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(DispatchResult{Kind: "run", RunID: "abc123"})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	res, err := c.Dispatch(context.Background(), "planner", "analyse ceci", "yoann")
	if err != nil {
		t.Fatalf("Dispatch: %v", err)
	}
	if res.Kind != "run" || res.RunID != "abc123" {
		t.Errorf("got %+v", res)
	}
}

func TestDispatchMapsAnUnknownSkillToUnknownSkillError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": "unknown skill (known: heartbeat, planner)",
			"known": []string{"heartbeat", "planner"},
		})
	}))
	defer srv.Close()

	c := &Client{BaseURL: srv.URL}
	_, err := c.Dispatch(context.Background(), "jamais", "", "")
	var unknown *UnknownSkillError
	if !errors.As(err, &unknown) {
		t.Fatalf("err = %v, want *UnknownSkillError", err)
	}
	if len(unknown.Known) != 2 || unknown.Known[0] != "heartbeat" {
		t.Errorf("Known = %v", unknown.Known)
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
