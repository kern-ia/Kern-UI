package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/yoann/kern-ui/internal/projection"
)

// maxStepBody caps the ingested payload. The merged state of a graph level is small; a
// larger body means something is wrong upstream.
const maxStepBody = 1 << 20 // 1 MiB

// handleIngestStep accepts one graph level pushed by kern-orch. Replays and stale steps
// are accepted and change nothing, so a reporter may retry without coordination.
func (s *server) handleIngestStep(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var ev projection.StepEvent
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxStepBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&ev); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("malformed step event: %v", err))
		return
	}

	switch {
	case ev.RunID == "":
		ev.RunID = id
	case ev.RunID != id:
		writeError(w, http.StatusBadRequest,
			fmt.Sprintf("run_id %q contradicts the path %q", ev.RunID, id))
		return
	}

	run, changed, err := s.cfg.Runs.Apply(ev)
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

func (s *server) handleListRuns(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.cfg.Runs.List())
}

func (s *server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	run, ok := s.cfg.Runs.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "unknown run")
		return
	}
	writeJSON(w, http.StatusOK, run)
}
