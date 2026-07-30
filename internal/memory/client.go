// Package memory reads and resolves kern-memory's documents, as a person's browser would
// want to for the Rédaction view — the read+decide side of C8. It is a client, not a
// producer: kern-ui pulls this contract on demand, the same shape as internal/tools and
// internal/steer.
package memory

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

// ErrUnknownDocument is returned by Get and Resolve when kern-memory has no document of
// that id.
var ErrUnknownDocument = errors.New("memory: unknown document")

// ErrUnknownSuggestion is returned by Resolve when kern-memory has no suggestion of that id
// on the given document.
var ErrUnknownSuggestion = errors.New("memory: unknown suggestion")

// Summary mirrors kern-memory's list entry: no body, no suggestions.
type Summary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	WordCount int    `json:"word_count"`
	UpdatedAt string `json:"updated_at"`
}

// Suggestion mirrors kern-memory's wire shape.
type Suggestion struct {
	ID          string `json:"id"`
	AnchorStart int    `json:"anchor_start"`
	AnchorEnd   int    `json:"anchor_end"`
	Text        string `json:"text"`
	Status      string `json:"status"`
}

// Document mirrors kern-memory's wire shape: a summary plus its body and suggestions.
type Document struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Body        string       `json:"body"`
	WordCount   int          `json:"word_count"`
	UpdatedAt   string       `json:"updated_at"`
	Suggestions []Suggestion `json:"suggestions"`
}

// Client reads and resolves documents published by one kern-memory daemon.
type Client struct {
	// BaseURL is kern-memory's `serve` address. Empty means no document source is
	// configured — Enabled reports that.
	BaseURL string
	// Token is the bearer credential kern-memory's daemon requires.
	Token string
	HTTP  *http.Client
}

// Enabled reports whether a document source is configured at all.
func (c *Client) Enabled() bool {
	return c != nil && c.BaseURL != ""
}

// List returns kern-memory's document catalogue.
func (c *Client) List(ctx context.Context) ([]Summary, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/api/v1/documents", nil)
	if err != nil {
		return nil, fmt.Errorf("memory: build list request: %w", err)
	}
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("memory: list: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("memory: list: kern-memory answered %s", resp.Status)
	}
	var out []Summary
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("memory: decode list: %w", err)
	}
	return out, nil
}

// Get returns one document with its suggestions. ErrUnknownDocument on a 404.
func (c *Client) Get(ctx context.Context, id string) (Document, error) {
	endpoint := c.BaseURL + "/api/v1/documents/" + url.PathEscape(id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Document{}, fmt.Errorf("memory: build get request: %w", err)
	}
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return Document{}, fmt.Errorf("memory: get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return Document{}, ErrUnknownDocument
	}
	if resp.StatusCode != http.StatusOK {
		return Document{}, fmt.Errorf("memory: get: kern-memory answered %s", resp.Status)
	}
	var doc Document
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return Document{}, fmt.Errorf("memory: decode get: %w", err)
	}
	return doc, nil
}

// Resolve accepts or ignores a pending suggestion. ErrUnknownDocument or
// ErrUnknownSuggestion on a 404, distinguished by kern-memory's own error message.
func (c *Client) Resolve(ctx context.Context, docID, suggestionID string, accept bool) error {
	verb := "ignore"
	if accept {
		verb = "accept"
	}
	endpoint := c.BaseURL + "/api/v1/documents/" + url.PathEscape(docID) +
		"/suggestions/" + url.PathEscape(suggestionID) + "/" + verb

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(nil))
	if err != nil {
		return fmt.Errorf("memory: build resolve request: %w", err)
	}
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return fmt.Errorf("memory: resolve: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}
	if resp.StatusCode == http.StatusNotFound {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		if errBody.Error == "unknown suggestion" {
			return ErrUnknownSuggestion
		}
		return ErrUnknownDocument
	}
	return fmt.Errorf("memory: resolve: kern-memory answered %s", resp.Status)
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
