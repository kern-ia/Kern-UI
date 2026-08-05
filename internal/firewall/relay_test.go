package firewall

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/yoann/kern-ui/internal/stream"
)

func TestRelayPublishesDecisionsFromTheStream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `data: {"rule":"too-many","run_id":"r1","layer":"behaviour","decision":"warn"}`+"\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer srv.Close()

	hub := stream.NewHub[Decision](8)
	ch, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go Relay(ctx, &Client{BaseURL: srv.URL}, hub)

	select {
	case d := <-ch:
		if d.Rule != "too-many" || d.RunID != "r1" {
			t.Errorf("decision = %+v", d)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no decision relayed within the deadline")
	}
}

func TestRelaySendsTheBearerToken(t *testing.T) {
	var gotAuth atomic.Value
	gotAuth.Store("")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth.Store(r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go Relay(ctx, &Client{BaseURL: srv.URL, Token: "un-jeton"}, stream.NewHub[Decision](8))

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if gotAuth.Load().(string) != "" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if got := gotAuth.Load().(string); got != "Bearer un-jeton" {
		t.Errorf("Authorization = %q", got)
	}
}

// The whole point: a dropped connection (the firewall restarting, a network
// blip) must not end the relay — it reconnects and keeps delivering.
func TestRelayReconnectsAfterTheStreamCloses(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `data: {"rule":"call-%d","run_id":"r1","layer":"behaviour","decision":"warn"}`+"\n\n", n)
		w.(http.Flusher).Flush()
		// First connection: close immediately, forcing a reconnect. Second
		// connection onward: stay open until the client goes away.
		if n == 1 {
			return
		}
		<-r.Context().Done()
	}))
	defer srv.Close()

	hub := stream.NewHub[Decision](8)
	ch, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go Relay(ctx, &Client{BaseURL: srv.URL}, hub)

	seen := map[string]bool{}
	deadline := time.After(5 * time.Second)
	for len(seen) < 2 {
		select {
		case d := <-ch:
			seen[d.Rule] = true
		case <-deadline:
			t.Fatalf("only saw %v before the deadline, want two calls worth of decisions", seen)
		}
	}
}

// A malformed event must not take the whole relay down — the next valid
// event on the same connection still has to arrive.
func TestRelaySkipsAMalformedEventAndContinues(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "data: not valid json\n\n")
		w.(http.Flusher).Flush()
		fmt.Fprint(w, `data: {"rule":"after-garbage","run_id":"r1","layer":"behaviour","decision":"warn"}`+"\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer srv.Close()

	hub := stream.NewHub[Decision](8)
	ch, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go Relay(ctx, &Client{BaseURL: srv.URL}, hub)

	select {
	case d := <-ch:
		if d.Rule != "after-garbage" {
			t.Errorf("Rule = %q", d.Rule)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the valid event after the malformed one never arrived")
	}
}

func TestRelayStopsWhenContextIsCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		Relay(ctx, &Client{BaseURL: srv.URL}, stream.NewHub[Decision](8))
		close(done)
	}()

	time.Sleep(50 * time.Millisecond) // let it connect
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Relay did not return after its context was cancelled")
	}
}

// A firewall that is not configured at all must not even try — Enabled()
// false is a compile-time-obvious no-op, not a connection attempt that fails
// forever.
func TestRelayDoesNothingWhenTheClientIsNotEnabled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		Relay(ctx, &Client{}, stream.NewHub[Decision](8))
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Relay did not return immediately for a disabled client")
	}
	cancel()
}
