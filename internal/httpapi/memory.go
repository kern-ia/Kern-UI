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

// handleListCriteria proxies kern-memory's declarative (.okf) layer for Critères
// banques: every fact with a natural lookup key — the taux d'usure, a partner bank's
// acceptance rules — never the semantic/vector layer, which has no such key to list by.
// Unconfigured reads as 404, same reasoning as the document endpoints above.
func (s *server) handleListCriteria(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no memory source configured")
		return
	}
	recalls, err := s.cfg.Memory.QueryMemory(r.Context(), memory.MemoryQuery{Kind: "okf"})
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, recalls)
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
