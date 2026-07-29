package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/yoann/kern-ui/internal/tools"
)

// handleListTools proxies kern-orch's tool catalogue for the Espace. Unconfigured reads as
// 404, same as an unpublished registry: "nothing answers this" is a fact the browser must
// be able to tell apart from "kern-orch answered and has none".
func (s *server) handleListTools(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Tools.Enabled() {
		writeError(w, http.StatusNotFound, "no tool source configured")
		return
	}
	specs, err := s.cfg.Tools.List(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, specs)
}

// handleInvokeTool proxies one invocation. kern-orch's own validation message travels
// through as 400 rather than a generic failure — the reader can act on "missing required
// param" in a way they cannot act on "bad gateway".
func (s *server) handleInvokeTool(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Tools.Enabled() {
		writeError(w, http.StatusNotFound, "no tool source configured")
		return
	}

	var body struct {
		Input map[string]any `json:"input"`
	}
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			writeError(w, http.StatusBadRequest, "malformed body: want {\"input\":{...}}")
			return
		}
	}

	result, err := s.cfg.Tools.Invoke(r.Context(), r.PathValue("name"), body.Input)
	var invalid *tools.InvalidInputError
	switch {
	case errors.Is(err, tools.ErrUnknownTool):
		writeError(w, http.StatusNotFound, "unknown tool")
	case errors.As(err, &invalid):
		writeError(w, http.StatusBadRequest, invalid.Message)
	case err != nil:
		writeError(w, http.StatusBadGateway, err.Error())
	default:
		writeJSON(w, http.StatusOK, result)
	}
}
