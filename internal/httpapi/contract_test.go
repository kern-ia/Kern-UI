package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/yoann/kern-ui/internal/projection"
)

// contractFixture is the canonical kern.step-event/v1 payload. The identical file lives in
// Kern-Orch/contracts/, where a mirror test asserts its reporter emits exactly this. The
// two bricks share no code by design, so this fixture is the whole agreement between them:
// if either side drifts, one of the two tests goes red.
const contractFixture = "../../contracts/kern.step-event.v1.json"

func readFixture(t *testing.T) []byte {
	t.Helper()
	body, err := os.ReadFile(filepath.FromSlash(contractFixture))
	if err != nil {
		t.Fatalf("read the contract fixture: %v", err)
	}
	return body
}

// The producer's payload must go through the real ingestion route untouched — including
// DisallowUnknownFields, which turns any field kern-orch adds without telling us into a 400.
func TestContractFixtureIsAccepted(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d — the contract fixture was rejected: %s",
			rec.Code, http.StatusAccepted, rec.Body)
	}
}

// Accepting the payload is not enough: every field must reach the interface with its
// documented meaning.
func TestContractFixtureIsProjectedFaithfully(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	h.ServeHTTP(rec, req)

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/a23ead5373d9b746", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("the run is unknown after ingestion: status = %d", rec.Code)
	}

	var run projection.Run
	if err := json.NewDecoder(rec.Body).Decode(&run); err != nil {
		t.Fatalf("decode run: %v", err)
	}

	if run.Graph != "hello" {
		t.Errorf("graph = %q, want %q", run.Graph, "hello")
	}
	if run.Step != 2 {
		t.Errorf("step = %d, want 2", run.Step)
	}
	if got := run.Frontier; len(got) != 2 || got[0] != "synthese" || got[1] != "critique" {
		t.Errorf("frontier = %v, want [synthese critique]", got)
	}
	if run.Status != projection.StatusRunning {
		t.Errorf("status = %q, want %q — a non-empty frontier means the run continues",
			run.Status, projection.StatusRunning)
	}
	if run.StartedAt.Format("2006-01-02T15:04:05Z") != "2026-07-26T12:00:02Z" {
		t.Errorf("started_at = %v, want the fixture's at", run.StartedAt)
	}

	var state map[string]any
	if err := json.Unmarshal(run.State, &state); err != nil {
		t.Fatalf("decode state: %v", err)
	}
	if state["echo"] != "..." {
		t.Errorf("state = %v, want the business data to survive", state)
	}
}

// The fixture is the contract: it must itself satisfy the schema we publish.
func TestContractFixtureMatchesThePublishedSchema(t *testing.T) {
	var ev projection.StepEvent
	dec := json.NewDecoder(bytes.NewReader(readFixture(t)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&ev); err != nil {
		t.Fatalf("the fixture does not match projection.StepEvent: %v", err)
	}

	if err := ev.Validate(); err != nil {
		t.Errorf("the fixture fails our own validation: %v", err)
	}
}
