package projection

import (
	"errors"
	"slices"
	"testing"
)

func generating(runID, nodeID string, on bool, seconds int) ActivityEvent {
	return ActivityEvent{
		RunID:      runID,
		Graph:      "hello",
		NodeID:     nodeID,
		Generating: on,
		At:         at(seconds),
	}
}

// An agent generates *before* its level completes, so the first activity of a run always
// arrives before any step event. Dropping it would leave the beacon dark for the whole of
// a short run — which is most of them.
func TestActivityForAnUnknownRunOpensIt(t *testing.T) {
	p := New()

	run, changed, err := p.ApplyActivity(generating("r1", "greet", true, 1))
	if err != nil {
		t.Fatalf("ApplyActivity: %v", err)
	}
	if !changed {
		t.Error("the projection reports no change on the first activity of a run")
	}

	if run.Status != StatusRunning {
		t.Errorf("Status = %q, want %q — an empty frontier here means 'not reported yet', "+
			"not 'over'", run.Status, StatusRunning)
	}
	if run.Graph != "hello" {
		t.Errorf("Graph = %q, want it taken from the event", run.Graph)
	}
	if !slices.Contains(run.Generating, "greet") {
		t.Errorf("Generating = %v, want greet among them", run.Generating)
	}
}

func TestGeneratingStopsWhenTheNodeSaysSo(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "greet", true, 1))

	run, changed, err := p.ApplyActivity(generating("r1", "greet", false, 2))
	if err != nil {
		t.Fatalf("ApplyActivity: %v", err)
	}
	if !changed {
		t.Error("the end of a generation is a change")
	}
	if len(run.Generating) != 0 {
		t.Errorf("Generating = %v, want none", run.Generating)
	}
}

func TestGeneratingHoldsEveryNodeAtOnce(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "synthese", true, 1))
	_, _, _ = p.ApplyActivity(generating("r1", "critique", true, 1))

	run, _, _ := p.ApplyActivity(generating("r1", "analyse", true, 2))

	// Sorted, so a reader never has to sort and two snapshots compare equal.
	if want := []string{"analyse", "critique", "synthese"}; !slices.Equal(run.Generating, want) {
		t.Errorf("Generating = %v, want %v", run.Generating, want)
	}
}

// The reports are sent without blocking the run, so two of them can overtake each other.
// A late "started" must not resurrect a generation that has already ended.
func TestAnOutOfOrderSignalCannotResurrectAGeneration(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "greet", true, 1))
	_, _, _ = p.ApplyActivity(generating("r1", "greet", false, 3))

	run, changed, err := p.ApplyActivity(generating("r1", "greet", true, 2))
	if err != nil {
		t.Fatalf("ApplyActivity: %v", err)
	}
	if changed {
		t.Error("a stale signal was treated as a change")
	}
	if len(run.Generating) != 0 {
		t.Errorf("Generating = %v, want the newer 'stopped' to stand", run.Generating)
	}
}

// Nothing generates in a run that is over. Leaving a node behind would light the beacon
// for ever on a run nobody is watching any more.
func TestFinishingARunClearsWhatWasGenerating(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "greet", true, 1))

	run, _, err := p.Apply(StepEvent{
		RunID: "r1", Graph: "hello", Step: 1, Frontier: []string{}, At: at(5),
	})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if run.Status != StatusFinished {
		t.Fatalf("Status = %q, want finished", run.Status)
	}
	if len(run.Generating) != 0 {
		t.Errorf("Generating = %v, want none once the run is over", run.Generating)
	}
}

func TestFailingARunClearsWhatWasGenerating(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "greet", true, 1))

	run, _, _ := p.Apply(StepEvent{
		RunID: "r1", Graph: "hello", Step: 1, Frontier: []string{"greet"}, At: at(5),
		Error: &Failure{Message: "boom"},
	})

	if len(run.Generating) != 0 {
		t.Errorf("Generating = %v, want none once the run has failed", run.Generating)
	}
}

func TestActivityOnATerminalRunChangesNothing(t *testing.T) {
	p := New()
	_, _, _ = p.Apply(StepEvent{
		RunID: "r1", Graph: "hello", Step: 1, Frontier: []string{}, At: at(1),
	})

	run, changed, err := p.ApplyActivity(generating("r1", "greet", true, 2))
	if err != nil {
		t.Fatalf("ApplyActivity on a finished run should be accepted, got %v", err)
	}
	if changed {
		t.Error("a finished run was moved by an activity signal")
	}
	if len(run.Generating) != 0 {
		t.Errorf("Generating = %v, want none", run.Generating)
	}
}

// A step event must not disturb what is generating: the two contracts describe different
// things about the same run and neither owns the other's field.
func TestAStepEventLeavesGeneratingAlone(t *testing.T) {
	p := New()
	_, _, _ = p.ApplyActivity(generating("r1", "greet", true, 1))

	run, _, _ := p.Apply(StepEvent{
		RunID: "r1", Graph: "hello", Step: 1, Frontier: []string{"finish"}, At: at(2),
	})

	if !slices.Contains(run.Generating, "greet") {
		t.Errorf("Generating = %v, want greet still there", run.Generating)
	}
}

func TestApplyActivityRejectsWhatItCannotUse(t *testing.T) {
	cases := map[string]ActivityEvent{
		"no run id":  {Graph: "hello", NodeID: "greet", At: at(1)},
		"no graph":   {RunID: "r1", NodeID: "greet", At: at(1)},
		"no node id": {RunID: "r1", Graph: "hello", At: at(1)},
		"no at":      {RunID: "r1", Graph: "hello", NodeID: "greet"},
		"blank node": {RunID: "r1", Graph: "hello", NodeID: "  ", At: at(1)},
	}

	for name, ev := range cases {
		t.Run(name, func(t *testing.T) {
			_, _, err := New().ApplyActivity(ev)
			if err == nil {
				t.Fatal("accepted")
			}
			if !errors.Is(err, ErrInvalidEvent) {
				t.Errorf("error = %v, want it to wrap ErrInvalidEvent", err)
			}
		})
	}
}
