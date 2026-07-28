package projection

import (
	"bytes"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"
)

func at(offsetSeconds int) time.Time {
	return time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC).Add(time.Duration(offsetSeconds) * time.Second)
}

func event(runID string, step int, frontier ...string) StepEvent {
	return StepEvent{
		RunID:    runID,
		Graph:    "review",
		Step:     step,
		Frontier: frontier,
		State:    json.RawMessage(`{"k":"v"}`),
		At:       at(step),
	}
}

func TestFirstEventStartsRun(t *testing.T) {
	p := New()

	run, changed, err := p.Apply(event("r1", 1, "analyse"))
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if !changed {
		t.Error("changed = false, want true for a new run")
	}
	if run.Status != StatusRunning {
		t.Errorf("Status = %q, want %q", run.Status, StatusRunning)
	}
	if run.Graph != "review" {
		t.Errorf("Graph = %q, want %q", run.Graph, "review")
	}
	if !run.StartedAt.Equal(at(1)) {
		t.Errorf("StartedAt = %v, want %v", run.StartedAt, at(1))
	}
	if !run.EndedAt.IsZero() {
		t.Errorf("EndedAt = %v, want zero while running", run.EndedAt)
	}
}

func TestEmptyFrontierFinishesRun(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "analyse"))

	run, changed, err := p.Apply(event("r1", 2))
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if !changed {
		t.Error("changed = false, want true")
	}
	if run.Status != StatusFinished {
		t.Errorf("Status = %q, want %q", run.Status, StatusFinished)
	}
	if !run.EndedAt.Equal(at(2)) {
		t.Errorf("EndedAt = %v, want %v", run.EndedAt, at(2))
	}
	// StartedAt must survive later events.
	if !run.StartedAt.Equal(at(1)) {
		t.Errorf("StartedAt = %v, want %v", run.StartedAt, at(1))
	}
}

func TestStaleAndDuplicateStepsAreIgnored(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "analyse"))
	mustApply(t, p, event("r1", 2, "synthese"))

	for _, step := range []int{1, 2} {
		run, changed, err := p.Apply(event("r1", step, "regression"))
		if err != nil {
			t.Fatalf("Apply(step=%d): %v", step, err)
		}
		if changed {
			t.Errorf("step %d: changed = true, want false", step)
		}
		if run.Step != 2 {
			t.Errorf("step %d: Step = %d, want 2", step, run.Step)
		}
		if got := run.Frontier; len(got) != 1 || got[0] != "synthese" {
			t.Errorf("step %d: Frontier = %v, want [synthese]", step, got)
		}
	}
}

func TestEventsAfterFinishAreIgnored(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "analyse"))
	mustApply(t, p, event("r1", 2))

	run, changed, err := p.Apply(event("r1", 3, "zombie"))
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if changed {
		t.Error("changed = true, want false after the run finished")
	}
	if run.Status != StatusFinished {
		t.Errorf("Status = %q, want %q", run.Status, StatusFinished)
	}
}

func TestRunsAreIsolated(t *testing.T) {
	p := New()
	mustApply(t, p, event("r1", 1, "a"))
	mustApply(t, p, event("r2", 1, "b"))
	mustApply(t, p, event("r1", 2))

	r1, ok := p.Get("r1")
	if !ok || r1.Status != StatusFinished {
		t.Errorf("r1 = %+v, ok = %v, want finished", r1, ok)
	}
	r2, ok := p.Get("r2")
	if !ok || r2.Status != StatusRunning {
		t.Errorf("r2 = %+v, ok = %v, want running", r2, ok)
	}
}

func TestFrontierIsCopiedFromEvent(t *testing.T) {
	p := New()
	frontier := []string{"analyse"}
	ev := event("r1", 1)
	ev.Frontier = frontier

	mustApply(t, p, ev)
	frontier[0] = "mutated"

	run, _ := p.Get("r1")
	if run.Frontier[0] != "analyse" {
		t.Errorf("Frontier[0] = %q, want %q — the projection aliased the caller's slice",
			run.Frontier[0], "analyse")
	}
}

func TestListIsOrderedByStartMostRecentFirst(t *testing.T) {
	p := New()
	mustApply(t, p, event("old", 1, "a"))
	mustApply(t, p, event("new", 5, "b"))

	runs := p.List()
	if len(runs) != 2 {
		t.Fatalf("len(List()) = %d, want 2", len(runs))
	}
	if runs[0].ID != "new" || runs[1].ID != "old" {
		t.Errorf("List() order = [%s %s], want [new old]", runs[0].ID, runs[1].ID)
	}
}

func TestInvalidEventsAreRejected(t *testing.T) {
	cases := map[string]func(*StepEvent){
		"missing run id": func(e *StepEvent) { e.RunID = "" },
		"negative step":  func(e *StepEvent) { e.Step = -1 },
		"missing at":     func(e *StepEvent) { e.At = time.Time{} },
		"missing graph":  func(e *StepEvent) { e.Graph = "" },
		"invalid state":  func(e *StepEvent) { e.State = json.RawMessage(`{oops`) },
		"blank frontier": func(e *StepEvent) { e.Frontier = []string{""} },
	}

	for name, corrupt := range cases {
		t.Run(name, func(t *testing.T) {
			ev := event("r1", 1, "analyse")
			corrupt(&ev)

			if _, _, err := New().Apply(ev); !errors.Is(err, ErrInvalidEvent) {
				t.Errorf("err = %v, want ErrInvalidEvent", err)
			}
		})
	}
}

func TestEmptyStateIsAccepted(t *testing.T) {
	ev := event("r1", 1, "analyse")
	ev.State = nil

	if _, _, err := New().Apply(ev); err != nil {
		t.Errorf("Apply with nil state: %v, want nil", err)
	}
}

func TestConcurrentApplyIsSafe(t *testing.T) {
	p := New()
	var wg sync.WaitGroup

	for i := range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _ = p.Apply(event("r1", i+1, "n"))
			_ = p.List()
			_, _ = p.Get("r1")
		}()
	}
	wg.Wait()

	if run, ok := p.Get("r1"); !ok || run.Step != 50 {
		t.Errorf("Step = %d, ok = %v, want 50 — the highest step must win", run.Step, ok)
	}
}

func mustApply(t *testing.T, p *Projection, ev StepEvent) Run {
	t.Helper()
	run, _, err := p.Apply(ev)
	if err != nil {
		t.Fatalf("Apply(%s step=%d): %v", ev.RunID, ev.Step, err)
	}
	return run
}

func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }
