// Package firewall reads consumption and behaviour data published by the AI
// firewall brick, for the Vigie view — the read side of its C4 (budget) and
// C3 (decision stream) contracts. It is a client, not a producer: kern-ui
// pulls the budget on demand, the same posture as internal/tools reading
// kern-orch's catalogue, because a gauge value is asked for when a view opens
// rather than emitted on its own schedule. The decision stream (C3) is
// different — see relay.go — because a discrete event missed between polls is
// gone for good.
package firewall

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Budget mirrors the firewall's C4 response body verbatim.
type Budget struct {
	SpentMicros      int64  `json:"spent_micros"`
	LimitMicros      int64  `json:"limit_micros"`
	UnpricedCalls    int    `json:"unpriced_calls"`
	UnaccountedCalls int    `json:"unaccounted_calls"`
	WindowResetsAt   string `json:"window_resets_at"`
}

// Decision mirrors one event of the firewall's C3 decision stream.
type Decision struct {
	At      string `json:"at"`
	Layer   string `json:"layer"`
	Kind    string `json:"decision"`
	Rule    string `json:"rule"`
	RunID   string `json:"run_id"`
	AgentID string `json:"agent_id,omitempty"`
}

// Client reads one AI firewall's published data.
type Client struct {
	// BaseURL is the firewall's own address. Empty means no firewall is
	// configured — Enabled reports that, so a caller can answer "not
	// configured" rather than trying to reach an empty string.
	BaseURL string
	// Token is the bearer credential the firewall's C3/C4 read surfaces
	// require. kern-ui here is the caller, presenting its own token to
	// another brick's API — the opposite direction from ProducerToken, which
	// is a credential kern-ui itself checks.
	Token string
	HTTP  *http.Client
}

// Enabled reports whether a firewall source is configured at all.
func (c *Client) Enabled() bool {
	return c != nil && c.BaseURL != ""
}

// Budget reads the current window's consumption snapshot (C4).
func (c *Client) Budget(ctx context.Context) (Budget, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/v1/budget", nil)
	if err != nil {
		return Budget{}, fmt.Errorf("firewall: build budget request: %w", err)
	}
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return Budget{}, fmt.Errorf("firewall: budget: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Budget{}, fmt.Errorf("firewall: budget: answered %s", resp.Status)
	}
	var b Budget
	if err := json.NewDecoder(resp.Body).Decode(&b); err != nil {
		return Budget{}, fmt.Errorf("firewall: decode budget: %w", err)
	}
	return b, nil
}

func (c *Client) authenticate(req *http.Request) {
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
}

func (c *Client) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}
