// Package projection turns the step transitions pushed by kern-orch into the run state
// the interface displays.
//
// This projection is a disposable cache, never a source of truth: kern-orch's checkpoints
// remain authoritative. Losing it must cost nothing but a reload.
package projection

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

// ErrInvalidEvent reports an event that does not satisfy the ingestion contract.
var ErrInvalidEvent = errors.New("invalid step event")

// Status is where a run stands.
type Status string

const (
	StatusRunning  Status = "running"
	StatusFinished Status = "finished"
)

// StepEvent is the ingestion contract: one graph level completed in kern-orch. It mirrors
// graph.StepInfo plus the identity of the run and the merged state.
type StepEvent struct {
	RunID    string          `json:"run_id"`
	Graph    string          `json:"graph"`
	Step     int             `json:"step"`
	Frontier []string        `json:"frontier"`
	State    json.RawMessage `json:"state,omitempty"`
	At       time.Time       `json:"at"`
}

// Validate checks the event against the ingestion contract.
func (e StepEvent) Validate() error {
	switch {
	case strings.TrimSpace(e.RunID) == "":
		return fmt.Errorf("%w: run_id is required", ErrInvalidEvent)
	case strings.TrimSpace(e.Graph) == "":
		return fmt.Errorf("%w: graph is required", ErrInvalidEvent)
	case e.Step < 0:
		return fmt.Errorf("%w: step must not be negative, got %d", ErrInvalidEvent, e.Step)
	case e.At.IsZero():
		return fmt.Errorf("%w: at is required", ErrInvalidEvent)
	}

	for i, node := range e.Frontier {
		if strings.TrimSpace(node) == "" {
			return fmt.Errorf("%w: frontier[%d] is blank", ErrInvalidEvent, i)
		}
	}

	if len(e.State) > 0 && !json.Valid(e.State) {
		return fmt.Errorf("%w: state is not valid JSON", ErrInvalidEvent)
	}
	return nil
}

// Run is the displayed state of a single kern-orch run.
type Run struct {
	ID        string          `json:"id"`
	Graph     string          `json:"graph"`
	Status    Status          `json:"status"`
	Step      int             `json:"step"`
	Frontier  []string        `json:"frontier"`
	State     json.RawMessage `json:"state,omitempty"`
	StartedAt time.Time       `json:"started_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	EndedAt   time.Time       `json:"ended_at,omitzero"`
}

// Projection holds the current state of every known run. It is safe for concurrent use.
type Projection struct {
	mu   sync.RWMutex
	runs map[string]Run
}

// New returns an empty projection.
func New() *Projection {
	return &Projection{runs: make(map[string]Run)}
}

// Apply folds an event into the projection and returns the resulting run. The boolean
// reports whether the run actually moved: stale, duplicate and post-completion events are
// accepted without error and change nothing, so a reporter may safely retry.
func (p *Projection) Apply(ev StepEvent) (Run, bool, error) {
	if err := ev.Validate(); err != nil {
		return Run{}, false, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	run, known := p.runs[ev.RunID]
	if known && (run.Status == StatusFinished || ev.Step <= run.Step) {
		return run, false, nil
	}

	if !known {
		run = Run{ID: ev.RunID, Graph: ev.Graph, StartedAt: ev.At}
	}

	run.Step = ev.Step
	run.Frontier = slices.Clone(ev.Frontier)
	run.State = slices.Clone(ev.State)
	run.UpdatedAt = ev.At

	// kern-orch reports the *next* frontier: an empty one means the run is over.
	if len(ev.Frontier) == 0 {
		run.Status = StatusFinished
		run.EndedAt = ev.At
	} else {
		run.Status = StatusRunning
	}

	p.runs[ev.RunID] = run
	return run, true, nil
}

// Get returns a run by id.
func (p *Projection) Get(id string) (Run, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	run, ok := p.runs[id]
	return run, ok
}

// List returns every known run, most recently started first. Ties break on id so the
// order stays stable across calls.
func (p *Projection) List() []Run {
	p.mu.RLock()
	defer p.mu.RUnlock()

	runs := make([]Run, 0, len(p.runs))
	for _, run := range p.runs {
		runs = append(runs, run)
	}

	sort.Slice(runs, func(i, j int) bool {
		if runs[i].StartedAt.Equal(runs[j].StartedAt) {
			return runs[i].ID < runs[j].ID
		}
		return runs[i].StartedAt.After(runs[j].StartedAt)
	})
	return runs
}
