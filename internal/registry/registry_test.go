package registry

import (
	"errors"
	"testing"
	"time"
)

func catalogue(skills ...Skill) Catalogue {
	return Catalogue{
		Source: "kern-orch",
		At:     time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC),
		Skills: skills,
	}
}

func TestStoreHoldsNothingUntilAProducerPublishes(t *testing.T) {
	s := New()

	if _, ok := s.Snapshot(); ok {
		t.Error("a fresh store reports a catalogue it never received")
	}
}

// The distinction the interface depends on: a kern-orch with no skills is not the same
// thing as a kern-orch that never spoke. The first is an empty Grimoire, the second is a
// view still waiting for its producer.
func TestAnEmptyCatalogueIsStillACatalogue(t *testing.T) {
	s := New()

	if err := s.Replace(catalogue()); err != nil {
		t.Fatalf("Replace: %v", err)
	}

	got, ok := s.Snapshot()
	if !ok {
		t.Fatal("an empty catalogue was mistaken for no catalogue at all")
	}
	if len(got.Skills) != 0 {
		t.Errorf("Skills = %v, want none", got.Skills)
	}
}

// A registry is republished whole, never patched: the producer's list is the truth, and a
// skill that disappears upstream must disappear here.
func TestReplaceSupersedesThePreviousCatalogue(t *testing.T) {
	s := New()

	if err := s.Replace(catalogue(
		Skill{Name: "Analyse", Kind: KindTool},
		Skill{Name: "Vigilance", Kind: KindTool},
	)); err != nil {
		t.Fatalf("first Replace: %v", err)
	}
	if err := s.Replace(catalogue(Skill{Name: "Analyse", Kind: KindTool})); err != nil {
		t.Fatalf("second Replace: %v", err)
	}

	got, _ := s.Snapshot()
	if len(got.Skills) != 1 || got.Skills[0].Name != "Analyse" {
		t.Errorf("Skills = %v, want the second publication alone", got.Skills)
	}
}

// Readers must not have to sort. The producer's order is its own business.
func TestSnapshotIsSortedByName(t *testing.T) {
	s := New()
	_ = s.Replace(catalogue(
		Skill{Name: "Vigilance", Kind: KindTool},
		Skill{Name: "Analyse", Kind: KindTool},
		Skill{Name: "Scribe", Kind: KindAgent},
	))

	got, _ := s.Snapshot()
	want := []string{"Analyse", "Scribe", "Vigilance"}
	for i, name := range want {
		if got.Skills[i].Name != name {
			t.Fatalf("Skills = %v, want them sorted %v", got.Skills, want)
		}
	}
}

// Snapshot hands out a copy: a caller mutating what it received must not reach into the
// store. The HTTP layer marshals it straight to the wire, so aliasing would be a data race
// waiting for a second reader.
func TestSnapshotDoesNotAliasTheStore(t *testing.T) {
	s := New()
	_ = s.Replace(catalogue(Skill{Name: "Analyse", Kind: KindTool}))

	got, _ := s.Snapshot()
	got.Skills[0].Name = "tampered"

	again, _ := s.Snapshot()
	if again.Skills[0].Name != "Analyse" {
		t.Errorf("the store was mutated through a snapshot: %v", again.Skills)
	}
}

func TestReplaceRejectsWhatTheInterfaceCannotDraw(t *testing.T) {
	cases := []struct {
		name string
		cat  Catalogue
		why  string
	}{
		{
			name: "unnamed skill",
			cat:  catalogue(Skill{Kind: KindTool}),
			why:  "a nameless skill has nothing to show in a card",
		},
		{
			name: "blank name",
			cat:  catalogue(Skill{Name: "   ", Kind: KindTool}),
			why:  "whitespace is not a name",
		},
		{
			name: "unknown kind",
			cat:  catalogue(Skill{Name: "Analyse", Kind: "widget"}),
			why:  "the Grimoire has two columns; a third kind belongs to neither",
		},
		{
			name: "missing kind",
			cat:  catalogue(Skill{Name: "Analyse"}),
			why:  "kern-orch's own loader refuses a skill without a type",
		},
		{
			name: "duplicate names",
			cat: catalogue(
				Skill{Name: "Analyse", Kind: KindTool},
				Skill{Name: "Analyse", Kind: KindAgent},
			),
			why: "the name is the key; two rows under one key make the catalogue ambiguous",
		},
		{
			name: "no source",
			cat:  Catalogue{At: time.Now(), Skills: []Skill{}},
			why:  "a catalogue that does not say who published it cannot be attributed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := New().Replace(tc.cat)
			if err == nil {
				t.Fatalf("accepted: %s", tc.why)
			}
			if !errors.Is(err, ErrInvalidCatalogue) {
				t.Errorf("error = %v, want it to wrap ErrInvalidCatalogue", err)
			}
		})
	}
}

// A rejected publication must not destroy the one already held: a producer pushing
// garbage is a producer bug, not a reason to blank the Grimoire.
func TestARejectedCataloguePreservesTheLastGoodOne(t *testing.T) {
	s := New()
	_ = s.Replace(catalogue(Skill{Name: "Analyse", Kind: KindTool}))

	if err := s.Replace(catalogue(Skill{Kind: KindTool})); err == nil {
		t.Fatal("the invalid catalogue was accepted")
	}

	got, ok := s.Snapshot()
	if !ok || len(got.Skills) != 1 || got.Skills[0].Name != "Analyse" {
		t.Errorf("Skills = %v, want the last valid catalogue intact", got.Skills)
	}
}
