package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/yoann/kern-ui/internal/projection"
)

// maxActivityBody caps the ingested signal. An activity event is five short fields.
const maxActivityBody = 1 << 14 // 16 KiB

// handleIngestActivity accepts one node starting or stopping generation.
//
// The result rides the existing run stream rather than a channel of its own: activity is a
// field of a run, so a browser already subscribed to runs receives it with no extra
// connection and no second thing to keep in sync.
func (s *server) handleIngestActivity(w http.ResponseWriter, r *http.Request) {
	var ev projection.ActivityEvent
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxActivityBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&ev); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("malformed activity event: %v", err))
		return
	}

	run, changed, err := s.cfg.Runs.ApplyActivity(ev)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, projection.ErrInvalidEvent) {
			status = http.StatusBadRequest
		}
		writeError(w, status, err.Error())
		return
	}

	if changed {
		s.cfg.Hub.Publish(run)
	}

	writeJSON(w, http.StatusAccepted, run)
}
