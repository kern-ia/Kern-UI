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
	StatusFailed   Status = "failed"
)

// validKinds are the node kinds a producer may declare.
var validKinds = map[string]bool{"tool": true, "agent": true, "subgraph": true}

// Topology is the shape of a run's graph, sent once at its start.
//
// A router picks its targets at run time, so such an edge arrives with no targets and
// Dynamic set: the picture is knowingly incomplete rather than wrong.
type Topology struct {
	Entry string         `json:"entry"`
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges,omitempty"`
}

// TopologyNode is one unit of work in the graph.
//
// Skill names the catalogue entry backing an agent node, and is what links a run to the
// Grimoire. It is not the id: a node `greet` may run the skill `planner`, so matching the
// two by name would be a guess. Tool nodes name a Go function instead and leave it empty.
type TopologyNode struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Skill string `json:"skill,omitempty"`
}

// TopologyEdge leaves a node towards its declared targets.
type TopologyEdge struct {
	From    string   `json:"from"`
	To      []string `json:"to,omitempty"`
	Dynamic bool     `json:"dynamic,omitempty"`
}

// Validate checks a declared topology hangs together.
func (t Topology) Validate() error {
	if strings.TrimSpace(t.Entry) == "" {
		return fmt.Errorf("%w: topology.entry is required", ErrInvalidEvent)
	}
	if len(t.Nodes) == 0 {
		return fmt.Errorf("%w: topology declares no node", ErrInvalidEvent)
	}

	known := make(map[string]bool, len(t.Nodes))
	for i, n := range t.Nodes {
		if strings.TrimSpace(n.ID) == "" {
			return fmt.Errorf("%w: topology.nodes[%d] has no id", ErrInvalidEvent, i)
		}
		if !validKinds[n.Kind] {
			return fmt.Errorf("%w: topology.nodes[%d] kind %q is not tool, agent or subgraph",
				ErrInvalidEvent, i, n.Kind)
		}
		known[n.ID] = true
	}
	if !known[t.Entry] {
		return fmt.Errorf("%w: topology.entry %q is not among the nodes", ErrInvalidEvent, t.Entry)
	}

	// Targets are not checked: a dynamic edge may reach a node the declaration never named.
	for i, e := range t.Edges {
		if !known[e.From] {
			return fmt.Errorf("%w: topology.edges[%d] leaves unknown node %q",
				ErrInvalidEvent, i, e.From)
		}
	}
	return nil
}

// ParentRef points a nested run at the subgraph node it belongs to.
//
// A nested run is a run of its own rather than part of its parent's stream: a parent's
// level counter is a sequence, and two graphs advancing against it at once would corrupt
// it. The reference also composes at any depth, where nesting topologies inside topologies
// would need a recursive schema for something that is really just another run.
type ParentRef struct {
	RunID  string `json:"run_id"`
	NodeID string `json:"node_id"`
}

// Validate checks a parent reference can be followed.
func (p ParentRef) Validate() error {
	if strings.TrimSpace(p.RunID) == "" {
		return fmt.Errorf("%w: parent.run_id is required", ErrInvalidEvent)
	}
	if strings.TrimSpace(p.NodeID) == "" {
		return fmt.Errorf("%w: parent.node_id is required", ErrInvalidEvent)
	}
	return nil
}

// Failure ends a run that did not complete.
//
// Nodes names the nodes of the reported frontier that actually broke. A node in that
// frontier and absent from here **completed** — the producer waits for the whole level
// before giving up, so this is knowledge rather than a guess. An empty Nodes means the
// producer could not say, and the interface then falls back to marking the frontier.
type Failure struct {
	Message string   `json:"message"`
	Nodes   []string `json:"nodes,omitempty"`
}

// StepEvent is the ingestion contract: one graph level completed in kern-orch. It mirrors
// graph.StepInfo plus the identity of the run and the merged state.
type StepEvent struct {
	RunID    string          `json:"run_id"`
	Graph    string          `json:"graph"`
	Step     int             `json:"step"`
	Frontier []string        `json:"frontier"`
	State    json.RawMessage `json:"state,omitempty"`
	At       time.Time       `json:"at"`

	// Topology rides on the first event of a run only.
	Topology *Topology `json:"topology,omitempty"`

	// Error is set on the terminal event of a run that failed.
	Error *Failure `json:"error,omitempty"`

	// Parent is set on a nested run and absent on a top-level one.
	Parent *ParentRef `json:"parent,omitempty"`
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

	if e.Topology != nil {
		if err := e.Topology.Validate(); err != nil {
			return err
		}
	}
	if e.Error != nil && strings.TrimSpace(e.Error.Message) == "" {
		return fmt.Errorf("%w: error.message is required when error is present", ErrInvalidEvent)
	}
	if e.Parent != nil {
		if err := e.Parent.Validate(); err != nil {
			return err
		}
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

	// Visited lists every node the run has reached, sorted. Derived from the frontiers
	// seen so far, so the interface can tell a node that is done from one that never ran.
	Visited []string `json:"visited,omitempty"`

	// Topology is captured from the first event that carries it and kept for the run.
	Topology *Topology `json:"topology,omitempty"`

	// Error is set when the run failed.
	Error *Failure `json:"error,omitempty"`

	// Parent is set when this run is the nested graph of a subgraph node in another run.
	Parent *ParentRef `json:"parent,omitempty"`

	// Generating lists the nodes whose model is producing output right now, sorted. Fed by
	// ActivityEvent, emptied when the run ends. It is what lets the beacon tell a run that
	// is thinking from one that is merely in flight.
	Generating []string `json:"generating,omitempty"`
}

// terminal reports whether a run can still move.
func (r Run) terminal() bool {
	return r.Status == StatusFinished || r.Status == StatusFailed
}

// Projection holds the current state of every known run. It is safe for concurrent use.
type Projection struct {
	mu   sync.RWMutex
	runs map[string]Run

	// activityAt remembers when each node last reported generating, keyed by run then node.
	// Activity is sent without blocking a run, so two signals can overtake each other; this
	// is what stops a late "started" from resurrecting a generation that already ended. It
	// is bookkeeping, never displayed, and dropped with the run that ends.
	activityAt map[string]map[string]time.Time
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
	// A failure arrives after the last successful level, so its step may equal the current
	// one. Treating it as stale would lose the failure entirely.
	stale := known && ev.Step <= run.Step && ev.Error == nil
	if known && (run.terminal() || stale) {
		return run, false, nil
	}

	if !known {
		run = Run{ID: ev.RunID, Graph: ev.Graph, StartedAt: ev.At, Parent: ev.Parent}
	}

	run.Step = ev.Step
	run.Frontier = slices.Clone(ev.Frontier)
	run.UpdatedAt = ev.At
	if len(ev.State) > 0 {
		run.State = slices.Clone(ev.State)
	}
	run.Visited = mergeVisited(run.Visited, ev.Frontier)
	// The topology rides on the first event only; keep it for the rest of the run.
	if ev.Topology != nil {
		run.Topology = ev.Topology
		// A frontier names what runs *next*, so the entry never appears in one — yet the
		// run began by executing it.
		run.Visited = mergeVisited(run.Visited, []string{ev.Topology.Entry})
	}

	switch {
	case ev.Error != nil:
		run.Status = StatusFailed
		run.Error = ev.Error
		run.EndedAt = ev.At
	// kern-orch reports the *next* frontier: an empty one means the run is over.
	case len(ev.Frontier) == 0:
		run.Status = StatusFinished
		run.EndedAt = ev.At
	default:
		run.Status = StatusRunning
	}

	// Nothing generates in a run that is over, and a node left behind would light the
	// beacon for ever on a run nobody is watching any more.
	if run.terminal() {
		run.Generating = nil
		p.forgetActivity(ev.RunID)
	}

	p.runs[ev.RunID] = run
	return run, true, nil
}

// ChildOf returns the nested run that a subgraph node produced, if one has reported.
//
// A node may run its subgraph more than once — a retry, a loop — and each execution is its
// own run. The freshest is the one worth drawing: it is what is happening, where the others
// are history the Agents view already lists separately.
func (p *Projection) ChildOf(parentRunID, nodeID string) (Run, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var newest Run
	var found bool
	for _, run := range p.runs {
		if run.Parent == nil || run.Parent.RunID != parentRunID || run.Parent.NodeID != nodeID {
			continue
		}
		if !found || run.StartedAt.After(newest.StartedAt) {
			newest, found = run, true
		}
	}
	return newest, found
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

// mergeVisited folds a frontier into the set of nodes already reached, keeping it sorted so
// the order never depends on map iteration.
func mergeVisited(visited, frontier []string) []string {
	if len(frontier) == 0 {
		return visited
	}

	merged := slices.Clone(visited)
	for _, node := range frontier {
		if !slices.Contains(merged, node) {
			merged = append(merged, node)
		}
	}
	slices.Sort(merged)
	return merged
}
