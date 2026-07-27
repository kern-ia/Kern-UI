package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/yoann/kern-ui/internal/registry"
)

// maxRegistryBody caps the ingested catalogue. A registry is a list of names and one-line
// descriptions; a larger body means something is wrong upstream.
const maxRegistryBody = 1 << 20 // 1 MiB

// handlePublishRegistry accepts the whole skills catalogue pushed by kern-orch. It is
// idempotent: republishing the same list changes nothing, so a producer may publish on
// every run without coordination.
func (s *server) handlePublishRegistry(w http.ResponseWriter, r *http.Request) {
	var cat registry.Catalogue
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRegistryBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cat); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("malformed catalogue: %v", err))
		return
	}

	if err := s.cfg.Registry.Replace(cat); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, registry.ErrInvalidCatalogue) {
			status = http.StatusBadRequest
		}
		writeError(w, status, err.Error())
		return
	}

	stored, _ := s.cfg.Registry.Snapshot()
	writeJSON(w, http.StatusAccepted, stored)
}

// handleGetRegistry serves the catalogue, or 404 when no producer has published one.
//
// The 404 is load-bearing: it is how the Grimoire tells "kern-orch has never spoken" from
// "kern-orch holds no skill". An empty 200 would collapse the two into the same screen,
// and the interface would claim an empty registry it has no evidence for.
func (s *server) handleGetRegistry(w http.ResponseWriter, _ *http.Request) {
	cat, ok := s.cfg.Registry.Snapshot()
	if !ok {
		writeError(w, http.StatusNotFound, "no registry published yet")
		return
	}
	writeJSON(w, http.StatusOK, cat)
}
