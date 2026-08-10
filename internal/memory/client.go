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

// Memory mirrors kern-memory's EPIC-13 wire shape (POST /api/v1/memory/write, /query) —
// distinct from Document/Suggestion above, which are the older C8 v1 slice of the same
// daemon (see kern-memory/CLAUDE.md for the split).
type Memory struct {
	ID       string            `json:"id"`
	Kind     string            `json:"kind"`
	Text     string            `json:"text"`
	Tags     []string          `json:"tags,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// MemoryQuery mirrors kern-memory's query request body.
type MemoryQuery struct {
	Text  string   `json:"text,omitempty"`
	Kind  string   `json:"kind,omitempty"`
	Tags  []string `json:"tags,omitempty"`
	Limit int      `json:"limit,omitempty"`
}

// Recall mirrors kern-memory's query response entry.
type Recall struct {
	Memory     Memory  `json:"memory"`
	Similarity float32 `json:"similarity"`
}

// WriteMemory upserts m — kern-memory's .okf layer overwrites on a repeated ID rather
// than erroring (see kern-memory/internal/memory/okf, "Write upserts").
func (c *Client) WriteMemory(ctx context.Context, m Memory) (Memory, error) {
	body, err := json.Marshal(m)
	if err != nil {
		return Memory{}, fmt.Errorf("memory: marshal write: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v1/memory/write", bytes.NewReader(body))
	if err != nil {
		return Memory{}, fmt.Errorf("memory: build write request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return Memory{}, fmt.Errorf("memory: write: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Memory{}, fmt.Errorf("memory: write: kern-memory answered %s", resp.Status)
	}
	var out Memory
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return Memory{}, fmt.Errorf("memory: decode write: %w", err)
	}
	return out, nil
}

// QueryMemory recalls memories matching q.
func (c *Client) QueryMemory(ctx context.Context, q MemoryQuery) ([]Recall, error) {
	body, err := json.Marshal(q)
	if err != nil {
		return nil, fmt.Errorf("memory: marshal query: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v1/memory/query", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("memory: build query request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("memory: query: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("memory: query: kern-memory answered %s", resp.Status)
	}
	var out []Recall
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("memory: decode query: %w", err)
	}
	return out, nil
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
