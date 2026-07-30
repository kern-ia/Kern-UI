package httpapi

import (
	"errors"
	"net/http"

	"github.com/yoann/kern-ui/internal/memory"
)

// handleListDocuments proxies kern-memory's document catalogue for Rédaction. Unconfigured
// reads as 404, same reasoning as Tools and Steer.
func (s *server) handleListDocuments(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no document source configured")
		return
	}
	list, err := s.cfg.Memory.List(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// handleGetDocument proxies one document with its suggestions.
func (s *server) handleGetDocument(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no document source configured")
		return
	}
	doc, err := s.cfg.Memory.Get(r.Context(), r.PathValue("id"))
	switch {
	case errors.Is(err, memory.ErrUnknownDocument):
		writeError(w, http.StatusNotFound, "unknown document")
	case err != nil:
		writeError(w, http.StatusBadGateway, err.Error())
	default:
		writeJSON(w, http.StatusOK, doc)
	}
}

// handleResolveSuggestion proxies accept/ignore for one suggestion.
func (s *server) handleResolveSuggestion(accept bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.cfg.Memory.Enabled() {
			writeError(w, http.StatusNotFound, "no document source configured")
			return
		}
		err := s.cfg.Memory.Resolve(r.Context(), r.PathValue("id"), r.PathValue("sid"), accept)
		switch {
		case errors.Is(err, memory.ErrUnknownDocument):
			writeError(w, http.StatusNotFound, "unknown document")
		case errors.Is(err, memory.ErrUnknownSuggestion):
			writeError(w, http.StatusNotFound, "unknown suggestion")
		case err != nil:
			writeError(w, http.StatusBadGateway, err.Error())
		default:
			status := "ignored"
			if accept {
				status = "accepted"
			}
			writeJSON(w, http.StatusOK, map[string]string{"status": status})
		}
	}
}
