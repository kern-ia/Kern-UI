package projection

import "testing"

func withRequester(runID string, step int, frontier ...string) StepEvent {
	ev := event(runID, step, frontier...)
	ev.Requester = "yoann"
	return ev
}

func TestRequesterIsKeptForTheWholeRun(t *testing.T) {
	p := New()
	mustApply(t, p, withRequester("r1", 1, "done"))

	// Later events do not carry it: the run must not lose who asked for it.
	run := mustApply(t, p, event("r1", 2, "done"))

	if run.Requester != "yoann" {
		t.Errorf("Requester = %q, want yoann", run.Requester)
	}
}

func TestARunWithoutARequesterStaysOpen(t *testing.T) {
	p := New()
	run := mustApply(t, p, event("r1", 1, "a"))

	if run.Requester != "" {
		t.Errorf("Requester = %q, want empty", run.Requester)
	}
}
