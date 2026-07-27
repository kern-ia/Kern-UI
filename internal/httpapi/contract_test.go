package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
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

// v2 adds the run's shape and its failures. Both fixtures are byte-identical to the ones in
// Kern-Orch/contracts/, where mirror tests assert the reporter emits exactly them.
const (
	contractV2        = "../../contracts/kern.step-event.v2.json"
	contractV2Failure = "../../contracts/kern.step-event.v2.failure.json"
)

func readFile(t *testing.T, path string) []byte {
	t.Helper()
	body, err := os.ReadFile(filepath.FromSlash(path))
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return body
}

func TestContractV2CarriesTheTopologyThrough(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFile(t, contractV2)))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusAccepted, rec.Body)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/a23ead5373d9b746", nil))
	var run projection.Run
	if err := json.NewDecoder(rec.Body).Decode(&run); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if run.Topology == nil {
		t.Fatal("the run has no topology")
	}
	if run.Topology.Entry != "greet" || len(run.Topology.Nodes) != 3 {
		t.Errorf("topology = %+v", run.Topology)
	}
	if !run.Topology.Edges[1].Dynamic {
		t.Error("the router-driven edge lost its dynamic flag")
	}
	// The skill an agent node runs is what links a run to the Grimoire's catalogue; the
	// node id is not that link. A tool node names a Go function and declares no skill.
	byID := map[string]projection.TopologyNode{}
	for _, n := range run.Topology.Nodes {
		byID[n.ID] = n
	}
	if got := byID["greet"].Skill; got != "planner" {
		t.Errorf("greet skill = %q, want planner", got)
	}
	if got := byID["critique"].Skill; got != "" {
		t.Errorf("critique skill = %q, want empty on a tool node", got)
	}
	// The entry never appears in a frontier, yet the run began by running it.
	if !slices.Contains(run.Visited, "greet") {
		t.Errorf("Visited = %v, want the entry among them", run.Visited)
	}
}

func TestContractV2FailureMarksTheRunFailed(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFile(t, contractV2Failure)))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusAccepted, rec.Body)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs/a23ead5373d9b746", nil))
	var run projection.Run
	_ = json.NewDecoder(rec.Body).Decode(&run)

	if run.Status != projection.StatusFailed {
		t.Errorf("Status = %q, want %q", run.Status, projection.StatusFailed)
	}
	if run.Error == nil || run.Error.Message == "" {
		t.Errorf("Error = %+v, want the failure message", run.Error)
	}
	// The frontier that was running is what tells the interface *where* it broke.
	if len(run.Frontier) != 1 || run.Frontier[0] != "synthese" {
		t.Errorf("Frontier = %v, want [synthese]", run.Frontier)
	}
}

// v1 payloads must keep working: the new fields are optional, so an old producer is still
// a valid one.
func TestContractV1StillIngests(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Errorf("status = %d, want %d — v1 producers must not be broken by v2", rec.Code, http.StatusAccepted)
	}
}
