// Package tools reads kern-orch's tool catalogue and invokes a tool on it, as a person's
// browser would want to for an Espace widget — the read side of C5. It is a client, not a
// producer: kern-ui pulls this contract on demand rather than being pushed to, because a
// tool's value is asked for when a widget opens, not emitted on its own schedule.
package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

// ErrUnknownTool is returned by Invoke when kern-orch has no tool of that name.
var ErrUnknownTool = errors.New("tools: unknown tool")

// InvalidInputError is returned by Invoke when kern-orch rejected the call itself — a
// missing required param, a wrong type — as opposed to a transport failure or an upstream
// fault. The distinction matters to a caller mapping this to an HTTP status: this one is
// the browser's request to fix, the others are kern-orch's problem.
type InvalidInputError struct {
	Message string
}

func (e *InvalidInputError) Error() string { return e.Message }

// Spec mirrors kern-orch's tools.Spec: what a widget needs before it can invoke a tool.
type Spec struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Params      []Param `json:"params,omitempty"`
}

// Param mirrors kern-orch's tools.Param.
type Param struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

// Result mirrors kern-orch's tools.Result: the rendered display value.
type Result struct {
	Label string `json:"label"`
	Value string `json:"value"`
	AsOf  string `json:"as_of"`
}

// Client reads and invokes tools published by one kern-orch daemon.
type Client struct {
	// BaseURL is kern-orch's `serve` address. Empty means no tool source is configured —
	// Enabled reports that, so a caller can answer "not configured" rather than trying to
	// reach an empty string.
	BaseURL string
	// Token is the bearer credential kern-orch's daemon requires. kern-ui here is the
	// caller, presenting its own token to another brick's API — the opposite direction
	// from ProducerToken, which is a credential kern-ui itself checks.
	Token string
	HTTP  *http.Client
}

// Enabled reports whether a tool source is configured at all.
func (c *Client) Enabled() bool {
	return c != nil && c.BaseURL != ""
}

// List returns kern-orch's tool catalogue.
func (c *Client) List(ctx context.Context) ([]Spec, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/api/v1/tools", nil)
	if err != nil {
		return nil, fmt.Errorf("tools: build list request: %w", err)
	}
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("tools: list: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tools: list: kern-orch answered %s", resp.Status)
	}
	var specs []Spec
	if err := json.NewDecoder(resp.Body).Decode(&specs); err != nil {
		return nil, fmt.Errorf("tools: decode list: %w", err)
	}
	return specs, nil
}

// Invoke runs the named tool with input and returns its display value. It returns
// ErrUnknownTool when kern-orch answers 404, and kern-orch's own message on any other
// non-200 — a validation failure is something the reader can act on, not a detail to hide
// behind a generic error.
func (c *Client) Invoke(ctx context.Context, name string, input map[string]any) (Result, error) {
	body, err := json.Marshal(map[string]any{"input": input})
	if err != nil {
		return Result{}, fmt.Errorf("tools: marshal input: %w", err)
	}

	endpoint := c.BaseURL + "/api/v1/tools/" + url.PathEscape(name) + "/invoke"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Result{}, fmt.Errorf("tools: build invoke request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("tools: invoke: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return Result{}, ErrUnknownTool
	}
	if resp.StatusCode != http.StatusOK {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		// A 4xx with a message is kern-orch rejecting the call itself (validation); any
		// other shape — a 5xx, or a 4xx with nothing to say — is kern-orch's own trouble,
		// not something the caller's input can fix.
		if resp.StatusCode >= 400 && resp.StatusCode < 500 && errBody.Error != "" {
			return Result{}, &InvalidInputError{Message: errBody.Error}
		}
		return Result{}, fmt.Errorf("tools: invoke: kern-orch answered %s", resp.Status)
	}

	var res Result
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return Result{}, fmt.Errorf("tools: decode invoke result: %w", err)
	}
	return res, nil
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
