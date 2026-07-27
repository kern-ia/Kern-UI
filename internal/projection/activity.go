package projection

import (
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"
)

// ActivityEvent reports that one node started or stopped generating: `kern.activity/v1`.
//
// It is a sibling of StepEvent, not part of it. A step describes a whole level that has
// *completed*; generation happens inside a level and has to be reported while it is
// happening, so no field on StepEvent could carry it without arriving too late to matter.
//
// It carries Graph for a reason: an agent generates before its level completes, so the
// first activity of a run always arrives before any step event. Without the graph name a
// consumer could not open the run and would have to drop the signal.
type ActivityEvent struct {
	RunID      string    `json:"run_id"`
	Graph      string    `json:"graph"`
	NodeID     string    `json:"node_id"`
	Generating bool      `json:"generating"`
	At         time.Time `json:"at"`
}

// Validate checks the event against the ingestion contract.
func (e ActivityEvent) Validate() error {
	switch {
	case strings.TrimSpace(e.RunID) == "":
		return fmt.Errorf("%w: run_id is required", ErrInvalidEvent)
	case strings.TrimSpace(e.Graph) == "":
		return fmt.Errorf("%w: graph is required", ErrInvalidEvent)
	case strings.TrimSpace(e.NodeID) == "":
		return fmt.Errorf("%w: node_id is required", ErrInvalidEvent)
	case e.At.IsZero():
		return fmt.Errorf("%w: at is required", ErrInvalidEvent)
	}
	return nil
}

// ApplyActivity folds an activity signal into the projection. Like Apply, it reports
// whether the run actually moved, and accepts stale signals without error.
func (p *Projection) ApplyActivity(ev ActivityEvent) (Run, bool, error) {
	if err := ev.Validate(); err != nil {
		return Run{}, false, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	run, known := p.runs[ev.RunID]
	if known && run.terminal() {
		// Nothing generates in a run that is over.
		return run, false, nil
	}

	// The reports do not block the run, so two of them can overtake each other on the
	// wire. Only the freshest word about a given node counts.
	if last, seen := p.activityAt[ev.RunID][ev.NodeID]; seen && !ev.At.After(last) {
		return run, false, nil
	}

	if !known {
		// An agent generates before its level completes, so this is the ordinary way a run
		// first appears. It is running by definition — something inside it is working —
		// and its empty frontier means "not reported yet", never "over".
		run = Run{
			ID:        ev.RunID,
			Graph:     ev.Graph,
			Status:    StatusRunning,
			Frontier:  []string{},
			StartedAt: ev.At,
		}
	}

	run.Generating = withNode(run.Generating, ev.NodeID, ev.Generating)
	run.UpdatedAt = ev.At

	p.rememberActivity(ev)
	p.runs[ev.RunID] = run
	return run, true, nil
}

// rememberActivity records when a node last spoke, so a later signal can be judged stale.
func (p *Projection) rememberActivity(ev ActivityEvent) {
	if p.activityAt == nil {
		p.activityAt = make(map[string]map[string]time.Time)
	}
	if p.activityAt[ev.RunID] == nil {
		p.activityAt[ev.RunID] = make(map[string]time.Time)
	}
	p.activityAt[ev.RunID][ev.NodeID] = ev.At
}

// forgetActivity drops a finished run's bookkeeping. Called under the lock.
func (p *Projection) forgetActivity(runID string) {
	delete(p.activityAt, runID)
}

// withNode returns the set with nodeID present or absent, sorted and freshly allocated so
// no caller can reach back into the projection through it.
func withNode(set []string, nodeID string, present bool) []string {
	out := slices.Clone(set)
	i := slices.Index(out, nodeID)

	switch {
	case present && i < 0:
		out = append(out, nodeID)
		sort.Strings(out)
	case !present && i >= 0:
		out = slices.Delete(out, i, i+1)
	}
	return out
}
