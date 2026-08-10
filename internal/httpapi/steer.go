package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/yoann/kern-ui/internal/steer"
)

// handleStopRun proxies C6's stop. Unconfigured reads as 404, same reasoning as the tools
// endpoints — a fact the browser must be able to tell apart from kern-orch refusing.
func (s *server) handleStopRun(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Steer.Enabled() {
		writeError(w, http.StatusNotFound, "no steering source configured")
		return
	}
	actor, _ := s.currentUser(r)

	err := s.cfg.Steer.Stop(r.Context(), r.PathValue("id"), actor)
	writeSteerResult(w, http.StatusAccepted, map[string]string{"status": "stopping"}, err)
}

// handleNudge proxies C6's nudge. The actor never comes from the body: a browser cannot
// claim to be someone else, only its own session says who is asking.
func (s *server) handleNudge(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Steer.Enabled() {
		writeError(w, http.StatusNotFound, "no steering source configured")
		return
	}
	var body struct {
		Key   string `json:"key"`
		Value any    `json:"value"`
	}
	if err := decodeSteerBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "malformed body: want {\"key\":\"...\",\"value\":...}")
		return
	}
	actor, _ := s.currentUser(r)

	err := s.cfg.Steer.Nudge(r.Context(), r.PathValue("id"), actor, body.Key, body.Value)
	writeSteerResult(w, http.StatusAccepted, map[string]string{"status": "queued"}, err)
}

// handleDecide proxies C6's decide.
func (s *server) handleDecide(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Steer.Enabled() {
		writeError(w, http.StatusNotFound, "no steering source configured")
		return
	}
	var body struct {
		Decision string `json:"decision"`
	}
	if err := decodeSteerBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "malformed body: want {\"decision\":\"approve|refuse\"}")
		return
	}
	actor, _ := s.currentUser(r)

	err := s.cfg.Steer.Decide(r.Context(), r.PathValue("id"), r.PathValue("node"), actor, body.Decision)
	writeSteerResult(w, http.StatusOK, map[string]string{"status": "decided"}, err)
}

// handleDispatch proxies C6's dispatch: an explicit `/skill text…` chat command.
func (s *server) handleDispatch(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Steer.Enabled() {
		writeError(w, http.StatusNotFound, "no steering source configured")
		return
	}
	var body struct {
		Skill   string `json:"skill"`
		Text    string `json:"text"`
		Dossier string `json:"dossier"`
	}
	if err := decodeSteerBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "malformed body: want {\"skill\":\"...\",\"text\":\"...\"}")
		return
	}
	if body.Skill == "" {
		writeError(w, http.StatusBadRequest, "skill is required")
		return
	}
	actor, _ := s.currentUser(r)

	result, err := s.cfg.Steer.Dispatch(r.Context(), body.Skill, body.Text, actor, body.Dossier)
	var unknown *steer.UnknownSkillError
	switch {
	case errors.As(err, &unknown):
		writeJSON(w, http.StatusNotFound, map[string]any{"error": unknown.Error(), "known": unknown.Known})
	case err != nil:
		writeSteerError(w, err)
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

// writeSteerResult maps every steer client error the same way across stop/nudge/decide,
// and answers okStatus/ok on success.
func writeSteerResult(w http.ResponseWriter, okStatus int, ok map[string]string, err error) {
	if err != nil {
		writeSteerError(w, err)
		return
	}
	writeJSON(w, okStatus, ok)
}

func writeSteerError(w http.ResponseWriter, err error) {
	var invalid *steer.InvalidInputError
	switch {
	case errors.Is(err, steer.ErrNotFound):
		writeError(w, http.StatusNotFound, "unknown run or node")
	case errors.Is(err, steer.ErrForbidden):
		writeError(w, http.StatusForbidden, "not this run's requester")
	case errors.As(err, &invalid):
		writeError(w, http.StatusBadRequest, invalid.Message)
	default:
		writeError(w, http.StatusBadGateway, err.Error())
	}
}

// decodeSteerBody decodes r's JSON body into v. A missing body is fine — only a
// genuinely malformed one is an error.
func decodeSteerBody(r *http.Request, v any) error {
	if r.Body == nil {
		return nil
	}
	if err := json.NewDecoder(r.Body).Decode(v); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}
