package projection

import "testing"

func withDossier(runID string, step int, frontier ...string) StepEvent {
	ev := event(runID, step, frontier...)
	ev.Dossier = "AF-2288"
	return ev
}

func TestDossierIsKeptForTheWholeRun(t *testing.T) {
	p := New()
	mustApply(t, p, withDossier("r1", 1, "done"))

	// Later events do not carry it: the run must not lose which case it belongs to.
	run := mustApply(t, p, event("r1", 2, "done"))

	if run.Dossier != "AF-2288" {
		t.Errorf("Dossier = %q, want AF-2288", run.Dossier)
	}
}

func TestARunWithoutADossierStaysUngrouped(t *testing.T) {
	p := New()
	run := mustApply(t, p, event("r1", 1, "a"))

	if run.Dossier != "" {
		t.Errorf("Dossier = %q, want empty", run.Dossier)
	}
}
