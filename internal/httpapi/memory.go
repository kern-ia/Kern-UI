package httpapi

import (
	"errors"
	"net/http"
	"strings"

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

// handleCerveau proxies C7's memory graph: the broad initial view (every graph root and
// its neighbourhood) with no query string, or one node's neighbourhood via
// ?from=<kind>:<id> — the "double-clic pour plonger" dive, a fresh view centered there.
// The browser never talks to kern-memory's traversal semantics itself; this is the one
// place kern-ui's backend does real fetch-and-assemble rather than a 1:1 proxy, since
// building one navigable graph needs several kern-memory calls merged together (see
// internal/memory/cerveau.go).
func (s *server) handleCerveau(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no memory source configured")
		return
	}
	focusKind, focusID := "", ""
	if from := r.URL.Query().Get("from"); from != "" {
		parts := strings.SplitN(from, ":", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			writeError(w, http.StatusBadRequest, "from must be \"<kind>:<id>\"")
			return
		}
		focusKind, focusID = parts[0], parts[1]
	}

	cerveau, err := s.cfg.Memory.BuildCerveau(r.Context(), focusKind, focusID)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cerveau)
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
