package firewall

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/yoann/kern-ui/internal/stream"
)

// relayInitialBackoff/relayMaxBackoff bound the delay between reconnection
// attempts — one reasonable default, not a new setting nobody has grounds to
// tune yet.
const (
	relayInitialBackoff = 500 * time.Millisecond
	relayMaxBackoff     = 30 * time.Second
)

// Relay subscribes to client's decision stream (C3) for as long as ctx is
// live, republishing every decision onto hub.
//
// This is the one place in kern-ui that pulls a live stream from a sibling
// brick rather than only ever being pushed to — the firewall's C3 was built
// to be subscribed to ("kern-pilot, or anything else, subscribes"), and
// nothing pushes decisions into kern-ui on its own initiative.
//
// A connection failure — the firewall not running yet, a restart, a network
// blip — never stops the relay: it retries with a capped exponential
// backoff, forever, until ctx is done. An unreachable firewall degrades to
// "no live decisions yet", the same way Client.Enabled() being false
// degrades Budget — it never blocks kern-ui's own startup or takes it down.
func Relay(ctx context.Context, client *Client, hub *stream.Hub[Decision]) {
	if !client.Enabled() {
		return
	}

	backoff := relayInitialBackoff
	for {
		if ctx.Err() != nil {
			return
		}

		connected, err := connectAndForward(ctx, client, hub)
		if err != nil && ctx.Err() == nil {
			slog.Warn("firewall decision relay disconnected", "err", err)
		}
		if connected {
			backoff = relayInitialBackoff
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}

		if !connected {
			backoff *= 2
			if backoff > relayMaxBackoff {
				backoff = relayMaxBackoff
			}
		}
	}
}

// connectAndForward makes one connection attempt and forwards decisions
// until it ends. connected reports whether the HTTP handshake itself
// succeeded (a 200 was received) — true even if the stream later drops,
// which is what lets Relay tell "never got through" (keep backing off) apart
// from "was connected fine, then dropped" (reset the backoff and retry
// promptly).
func connectAndForward(ctx context.Context, client *Client, hub *stream.Hub[Decision]) (connected bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, client.BaseURL+"/v1/decisions", nil)
	if err != nil {
		return false, fmt.Errorf("firewall: build decisions request: %w", err)
	}
	client.authenticate(req)

	resp, err := client.client().Do(req)
	if err != nil {
		return false, fmt.Errorf("firewall: decisions: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("firewall: decisions: answered %s", resp.Status)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		payload, ok := strings.CutPrefix(strings.TrimSpace(scanner.Text()), "data:")
		if !ok {
			continue
		}
		var d Decision
		if err := json.Unmarshal([]byte(strings.TrimSpace(payload)), &d); err != nil {
			// One bad event must not take the whole connection down — the
			// next valid one on the same stream still deserves to arrive.
			slog.Warn("firewall decision relay: malformed event", "err", err)
			continue
		}
		hub.Publish(d)
	}
	return true, scanner.Err()
}
