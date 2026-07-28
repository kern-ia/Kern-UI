package projection

import (
	"encoding/json"
	"errors"
	"testing"
)

func withTopology(runID string, step int, frontier ...string) StepEvent {
	ev := event(runID, step, frontier...)
	ev.Topology = &Topology{
		Entry: "think",
		Nodes: []TopologyNode{{ID: "think", Kind: "agent"}, {ID: "done", Kind: "tool"}},
		Edges: []TopologyEdge{{From: "think", To: []string{"done"}}},
	}
	return ev
}

func TestTopologyIsKeptForTheWholeRun(t *testing.T) {
	p := New()
	mustApply(t, p, withTopology("r1", 1, "done"))

	// Later events do not carry it: the run must not lose its shape.
	run := mustApply(t, p, event("r1", 2, "done"))

	if run.Topology == nil {
		t.Fatal("the run lost its topology after a step without one")
	}
	if run.Topology.Entry != "think" || len(run.Topology.Nodes) != 2 {
		t.Errorf("topology = %+v", run.Topology)
	}
}

func TestARunWithoutTopologyStaysWithoutOne(t *testing.T) {
	p := New()
	run := mustApply(t, p, event("r1", 1, "a"))

	if run.Topology != nil {
		t.Error("a topology appeared out of nowhere")
	}
}

func TestErrorMarksTheRunFailed(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "analyse"))

	ev := event("r1", 2)
	ev.Error = &Failure{Message: "agent think: exit status 1"}
	run := mustApply(t, p, ev)

	if run.Status != StatusFailed {
		t.Errorf("Status = %q, want %q", run.Status, StatusFailed)
	}
	if run.Error == nil || run.Error.Message != "agent think: exit status 1" {
		t.Errorf("Error = %+v", run.Error)
	}
	if run.EndedAt.IsZero() {
		t.Error("a failed run has no end date")
	}
}

// A failure arrives after the last successful level, so its step may equal the current one.
// Treating it as stale would lose the failure entirely.
func TestFailureIsAcceptedEvenAtTheCurrentStep(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 4, "analyse"))

	ev := event("r1", 4)
	ev.Error = &Failure{Message: "boom"}
	run, changed, err := p.Apply(ev)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if !changed {
		t.Error("changed = false — the failure was swallowed as a stale step")
	}
	if run.Status != StatusFailed {
		t.Errorf("Status = %q, want %q", run.Status, StatusFailed)
	}
}

func TestEventsAfterAFailureAreIgnored(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "a"))
	ev := event("r1", 2)
	ev.Error = &Failure{Message: "boom"}
	mustApply(t, p, ev)

	run, changed, _ := p.Apply(event("r1", 3, "zombie"))

	if changed || run.Status != StatusFailed {
		t.Errorf("changed = %v, status = %q — a failed run is over", changed, run.Status)
	}
}

func TestInvalidTopologyIsRejected(t *testing.T) {
	cases := map[string]func(*StepEvent){
		"no entry":      func(e *StepEvent) { e.Topology.Entry = "" },
		"no nodes":      func(e *StepEvent) { e.Topology.Nodes = nil },
		"blank node id": func(e *StepEvent) { e.Topology.Nodes[0].ID = "" },
		"unknown kind":  func(e *StepEvent) { e.Topology.Nodes[0].Kind = "wizard" },
		"edge nowhere":  func(e *StepEvent) { e.Topology.Edges[0].From = "ghost" },
	}

	for name, corrupt := range cases {
		t.Run(name, func(t *testing.T) {
			ev := withTopology("r1", 1, "done")
			corrupt(&ev)

			if _, _, err := New().Apply(ev); !errors.Is(err, ErrInvalidEvent) {
				t.Errorf("err = %v, want ErrInvalidEvent", err)
			}
		})
	}
}

func TestEmptyFailureMessageIsRejected(t *testing.T) {
	ev := event("r1", 1)
	ev.Error = &Failure{Message: "  "}

	if _, _, err := New().Apply(ev); !errors.Is(err, ErrInvalidEvent) {
		t.Errorf("err = %v, want ErrInvalidEvent", err)
	}
}

func TestTopologySurvivesTheWire(t *testing.T) {
	ev := withTopology("r1", 1, "done")
	raw, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var back StepEvent
	dec := json.NewDecoder(bytesReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&back); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if back.Topology == nil || back.Topology.Edges[0].To[0] != "done" {
		t.Errorf("topology did not round-trip: %+v", back.Topology)
	}
}

// The projection sees every frontier, so it can remember which nodes a run has already
// reached. That is derived, not new contract data — and it is what lets the interface tell
// a node that is done from one that never ran.
func TestVisitedNodesAccumulate(t *testing.T) {
	p := New()
	mustApply(t, p, withTopology("r1", 1, "think"))
	mustApply(t, p, event("r1", 2, "done", "audit"))
	run := mustApply(t, p, event("r1", 3))

	want := []string{"audit", "done", "think"}
	if len(run.Visited) != len(want) {
		t.Fatalf("Visited = %v, want %v", run.Visited, want)
	}
	for i, id := range want {
		if run.Visited[i] != id {
			t.Errorf("Visited = %v, want %v (sorted, so the order is stable)", run.Visited, want)
		}
	}
}

func TestVisitedHasNoDuplicates(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "loop"))
	mustApply(t, p, event("r1", 2, "loop"))
	run := mustApply(t, p, event("r1", 3, "loop"))

	if len(run.Visited) != 1 {
		t.Errorf("Visited = %v, want one entry", run.Visited)
	}
}

// The frontier names the nodes to run *next*, so the entry node never appears in one. Left
// alone it would show as "never ran" for the whole life of the run that started with it.
func TestEntryNodeCountsAsVisited(t *testing.T) {
	p := New()
	run := mustApply(t, p, withTopology("r1", 1, "done"))

	if !slicesContains(run.Visited, "think") {
		t.Errorf("Visited = %v, want the entry node think among them", run.Visited)
	}
}

func slicesContains(all []string, want string) bool {
	for _, v := range all {
		if v == want {
			return true
		}
	}
	return false
}
