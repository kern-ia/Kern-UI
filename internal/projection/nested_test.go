package projection

import "testing"

func nested(runID, nodeID string) *ParentRef {
	return &ParentRef{RunID: runID, NodeID: nodeID}
}

func nestedEvent(runID, graph string, step int, parent *ParentRef, frontier ...string) StepEvent {
	return StepEvent{
		RunID: runID, Graph: graph, Step: step,
		Frontier: frontier, At: at(step), Parent: parent,
	}
}

// A nested run keeps its own level sequence. Folding it into its parent's would corrupt the
// counter this projection uses to reject stale events.
func TestANestedRunIsARunOfItsOwn(t *testing.T) {
	p := New()
	_, _, _ = p.Apply(nestedEvent("parent", "top", 1, nil, "sub"))

	if _, _, err := p.Apply(nestedEvent("child", "inner", 1, nested("parent", "sub"), "c2")); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if got := len(p.List()); got != 2 {
		t.Fatalf("the projection holds %d runs, want 2", got)
	}
	child, ok := p.Get("child")
	if !ok {
		t.Fatal("the nested run is unknown")
	}
	if child.Parent == nil || child.Parent.NodeID != "sub" {
		t.Errorf("Parent = %+v, want the node it belongs to", child.Parent)
	}
	if parent, _ := p.Get("parent"); parent.Step != 1 {
		t.Errorf("the parent's step = %d, want 1 — a child must not advance it", parent.Step)
	}
}

// The only question the interface has: what ran inside this node?
func TestChildOfFindsTheRunBelongingToANode(t *testing.T) {
	p := New()
	_, _, _ = p.Apply(nestedEvent("child", "inner", 1, nested("parent", "sub"), "c2"))
	_, _, _ = p.Apply(nestedEvent("other", "inner", 1, nested("parent", "autre"), "x"))

	got, ok := p.ChildOf("parent", "sub")
	if !ok {
		t.Fatal("no nested run found for the node")
	}
	if got.ID != "child" {
		t.Errorf("ChildOf = %q, want child", got.ID)
	}

	if _, ok := p.ChildOf("parent", "jamais"); ok {
		t.Error("a node that ran no subgraph reported one")
	}
}

// The same node running twice — a retry, a loop — is two nested runs. The freshest is the
// one worth drawing.
func TestChildOfPrefersTheMostRecentRun(t *testing.T) {
	p := New()
	_, _, _ = p.Apply(nestedEvent("first", "inner", 1, nested("parent", "sub"), "a"))
	_, _, _ = p.Apply(nestedEvent("second", "inner", 5, nested("parent", "sub"), "b"))

	got, _ := p.ChildOf("parent", "sub")
	if got.ID != "second" {
		t.Errorf("ChildOf = %q, want the later run", got.ID)
	}
}

func TestApplyRejectsAParentThatPointsNowhere(t *testing.T) {
	cases := map[string]*ParentRef{
		"no run id":  {NodeID: "sub"},
		"no node id": {RunID: "parent"},
		"blank":      {RunID: "  ", NodeID: "sub"},
	}
	for name, parent := range cases {
		t.Run(name, func(t *testing.T) {
			if _, _, err := New().Apply(nestedEvent("child", "inner", 1, parent, "a")); err == nil {
				t.Error("accepted a parent reference that points nowhere")
			}
		})
	}
}
