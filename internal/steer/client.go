// Package steer reaches kern-orch's C6 write path — stop, nudge, decide, dispatch — on
// behalf of a logged-in person. Like internal/tools, kern-ui pulls this contract from
// kern-orch's daemon rather than being pushed to: a steering instruction only exists the
// moment someone in the browser sends one.
package steer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
)

// ErrNotFound is returned when kern-orch answers 404 — an unknown run, or (for Decide) a
// node not currently awaiting a decision. kern-orch's own body does not distinguish the
// two cases, so neither does this.
var ErrNotFound = errors.New("steer: not found")

// ErrForbidden is returned when the actor is not the run's own requester.
var ErrForbidden = errors.New("steer: not this run's requester")

// InvalidInputError is returned when kern-orch rejected the call itself — a missing key,
// an invalid decision value — as opposed to being unreachable or having its own trouble.
type InvalidInputError struct {
	Message string
}

func (e *InvalidInputError) Error() string { return e.Message }

// UnknownSkillError is returned by Dispatch when kern-orch has no skill of that name. It
// carries the names that do exist, so a mistyped command can show what is real.
type UnknownSkillError struct {
	Known []string
}

func (e *UnknownSkillError) Error() string {
	return fmt.Sprintf("steer: unknown skill (known: %v)", e.Known)
}

// ToolResult mirrors kern-orch's tools.Result — the rendered value a dispatched tool skill
// answers with.
type ToolResult struct {
	Label string `json:"label"`
	Value string `json:"value"`
	AsOf  string `json:"as_of"`
}

// DispatchResult mirrors kern-orch's daemon.DispatchResult: a tool's value, or the id of
// the run a dispatched agent skill just launched. Never both.
type DispatchResult struct {
	Kind   string      `json:"kind"`
	Result *ToolResult `json:"result,omitempty"`
	RunID  string      `json:"run_id,omitempty"`
}

// SkillStep is one instruction in a created sub-agent's chain (C11).
type SkillStep struct {
	Name         string `json:"name"`
	Instructions string `json:"instructions"`
}

// CreatedSkill mirrors kern-orch's skills.Skill — just the fields a browser needs to show
// a created skill in the Grimoire (never Command/Params, which belong to tool skills).
type CreatedSkill struct {
	Name        string `json:"Name"`
	Description string `json:"Description"`
	CreatedBy   string `json:"CreatedBy"`
	Custom      bool   `json:"Custom"`
}

// Client steers runs on one kern-orch daemon.
type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

// Enabled reports whether a kern-orch source is configured at all.
func (c *Client) Enabled() bool {
	return c != nil && c.BaseURL != ""
}

// Stop cancels a live run.
func (c *Client) Stop(ctx context.Context, runID, actor string) error {
	body, _ := json.Marshal(map[string]string{"actor": actor})
	_, err := c.post(ctx, "/api/v1/runs/"+url.PathEscape(runID)+"/stop", body)
	return err
}

// Nudge queues a state key/value for the next level of a live run.
func (c *Client) Nudge(ctx context.Context, runID, actor, key string, value any) error {
	body, err := json.Marshal(map[string]any{"actor": actor, "key": key, "value": value})
	if err != nil {
		return fmt.Errorf("steer: marshal nudge: %w", err)
	}
	_, err = c.post(ctx, "/api/v1/runs/"+url.PathEscape(runID)+"/nudge", body)
	return err
}

// Decide answers a pending approval node.
func (c *Client) Decide(ctx context.Context, runID, nodeID, actor, decision string) error {
	body, _ := json.Marshal(map[string]string{"actor": actor, "decision": decision})
	endpoint := "/api/v1/runs/" + url.PathEscape(runID) + "/nodes/" + url.PathEscape(nodeID) + "/decide"
	_, err := c.post(ctx, endpoint, body)
	return err
}

// Dispatch resolves an explicit `/skill text…` chat command. dossier is a caller-supplied
// business label (e.g. a client case), distinct from actor (an identity) — empty means
// the run belongs to no dossier.
func (c *Client) Dispatch(ctx context.Context, skill, text, actor, dossier string) (DispatchResult, error) {
	body, err := json.Marshal(map[string]string{
		"skill": skill, "text": text, "requester": actor, "dossier": dossier,
	})
	if err != nil {
		return DispatchResult{}, fmt.Errorf("steer: marshal dispatch: %w", err)
	}

	resp, err := c.post(ctx, "/api/v1/dispatch", body)
	if err != nil {
		return DispatchResult{}, err
	}

	var result DispatchResult
	if err := json.Unmarshal(resp, &result); err != nil {
		return DispatchResult{}, fmt.Errorf("steer: decode dispatch result: %w", err)
	}
	return result, nil
}

// CreateSkill writes a new agent sub-agent (C11): one node per step, chained in order.
// *InvalidInputError covers a name already taken, an invalid name, or an empty step list
// — kern-orch's own message is specific enough to show as-is.
func (c *Client) CreateSkill(ctx context.Context, name, description, actor string, steps []SkillStep) (CreatedSkill, error) {
	body, err := json.Marshal(map[string]any{
		"name": name, "description": description, "actor": actor, "steps": steps,
	})
	if err != nil {
		return CreatedSkill{}, fmt.Errorf("steer: marshal create skill: %w", err)
	}

	resp, err := c.post(ctx, "/api/v1/skills", body)
	if err != nil {
		return CreatedSkill{}, err
	}

	var sk CreatedSkill
	if err := json.Unmarshal(resp, &sk); err != nil {
		return CreatedSkill{}, fmt.Errorf("steer: decode created skill: %w", err)
	}
	return sk, nil
}

// DeleteSkill removes a created sub-agent. ErrNotFound if it is unknown or not a custom
// skill, ErrForbidden if actor did not create it.
func (c *Client) DeleteSkill(ctx context.Context, name, actor string) error {
	body, err := json.Marshal(map[string]string{"actor": actor})
	if err != nil {
		return fmt.Errorf("steer: marshal delete skill: %w", err)
	}
	_, err = c.do(ctx, http.MethodDelete, "/api/v1/skills/"+url.PathEscape(name), body)
	return err
}

// Upload streams content to kern-orch's real upload endpoint and returns the local path
// it was saved under — the same "text IS the document path" convention Dispatch already
// sends, just fed by a picked file instead of typed text.
func (c *Client) Upload(ctx context.Context, filename string, content io.Reader) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("steer: build upload form: %w", err)
	}
	if _, err := io.Copy(part, content); err != nil {
		return "", fmt.Errorf("steer: read upload content: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("steer: close upload form: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v1/uploads", &buf)
	if err != nil {
		return "", fmt.Errorf("steer: build upload request: %w", err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return "", fmt.Errorf("steer: upload: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("steer: upload: kern-orch answered %s", resp.Status)
	}
	var out struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("steer: decode upload result: %w", err)
	}
	return out.Path, nil
}

// post sends body to kern-orch via POST — see do for the status-code translation every
// steer endpoint shares.
func (c *Client) post(ctx context.Context, path string, body []byte) ([]byte, error) {
	return c.do(ctx, http.MethodPost, path, body)
}

// do sends body to kern-orch and returns the raw response body on success, translating
// kern-orch's status codes the same way for every steer endpoint: 404 -> ErrNotFound
// (or *UnknownSkillError when the body names known skills), 403 -> ErrForbidden, any other
// non-2xx with a message -> *InvalidInputError.
func (c *Client) do(ctx context.Context, method, path string, body []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("steer: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.authenticate(req)

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("steer: request: %w", err)
	}
	defer resp.Body.Close()

	var payload struct {
		Error string   `json:"error"`
		Known []string `json:"known"`
	}
	raw := json.NewDecoder(resp.Body)

	switch resp.StatusCode {
	case http.StatusOK, http.StatusAccepted, http.StatusCreated:
		return decodeSuccessBody(resp)
	case http.StatusNotFound:
		_ = raw.Decode(&payload)
		if payload.Known != nil {
			return nil, &UnknownSkillError{Known: payload.Known}
		}
		return nil, ErrNotFound
	case http.StatusForbidden:
		return nil, ErrForbidden
	default:
		_ = raw.Decode(&payload)
		if payload.Error != "" {
			return nil, &InvalidInputError{Message: payload.Error}
		}
		return nil, fmt.Errorf("steer: kern-orch answered %s", resp.Status)
	}
}

func decodeSuccessBody(resp *http.Response) ([]byte, error) {
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return nil, fmt.Errorf("steer: read response: %w", err)
	}
	return buf.Bytes(), nil
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
