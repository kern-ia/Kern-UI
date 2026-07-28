// Package registry holds the catalogue of skills and tools published by kern-orch.
//
// Like the run projection beside it, this is a disposable cache and never a source of
// truth: kern-orch owns the registry, kern-ui only mirrors what it was told. Losing it
// costs one republication.
//
// What travels is deliberately small, and the rules are stated about *a producer*, not
// about kern-orch: this package must keep working the day a second one publishes here.
//
//   - The name is the key. No identifier was invented for the wire, because a producer that
//     does not already hold one would have to make it up per publication.
//   - No filesystem path travels: where a skill lives is a producer's internal.
//   - No "wired" flag. A producer publishes what it holds, so the field would read true on
//     every row — a column carrying no information is a column to leave out.
//
// The origin of those three is in docs/expected-contracts.md, which records what the
// contract was asked for and what it turned out to need.
package registry

import (
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

// ErrInvalidCatalogue reports a publication that does not satisfy the ingestion contract.
var ErrInvalidCatalogue = errors.New("invalid registry catalogue")

// Kind is what a skill is: something executed directly, or a graph node backed by a model.
// Two kinds, which is also what the Grimoire draws as its two columns.
type Kind string

const (
	KindTool  Kind = "tool"
	KindAgent Kind = "agent"
)

func (k Kind) valid() bool { return k == KindTool || k == KindAgent }

// Skill is one entry of the catalogue.
type Skill struct {
	Name        string `json:"name"`
	Kind        Kind   `json:"kind"`
	Description string `json:"description,omitempty"`
}

// Catalogue is a whole publication: every skill a producer holds, at one instant.
//
// It is replaced wholesale rather than patched. A skill removed upstream must disappear
// here, and an incremental protocol would have to carry deletions — a second contract to
// get subtly wrong, for a payload that fits in a packet.
type Catalogue struct {
	Source string    `json:"source"`
	At     time.Time `json:"at"`
	Skills []Skill   `json:"skills"`
}

// Validate checks a catalogue can be drawn.
func (c Catalogue) Validate() error {
	if strings.TrimSpace(c.Source) == "" {
		return fmt.Errorf("%w: source is required", ErrInvalidCatalogue)
	}

	seen := make(map[string]bool, len(c.Skills))
	for i, s := range c.Skills {
		name := strings.TrimSpace(s.Name)
		if name == "" {
			return fmt.Errorf("%w: skills[%d] has no name", ErrInvalidCatalogue, i)
		}
		if !s.Kind.valid() {
			return fmt.Errorf("%w: skills[%d] kind %q is not tool or agent",
				ErrInvalidCatalogue, i, s.Kind)
		}
		if seen[name] {
			return fmt.Errorf("%w: skills[%d] repeats the name %q", ErrInvalidCatalogue, i, name)
		}
		seen[name] = true
	}
	return nil
}

// Store keeps the last catalogue a producer published.
type Store struct {
	mu       sync.RWMutex
	current  Catalogue
	received bool
}

// New returns an empty store, holding no catalogue.
func New() *Store { return &Store{} }

// Replace installs c as the whole catalogue. An invalid publication is refused and leaves
// the previous one standing: a producer pushing garbage is a bug upstream, not a reason to
// blank the view here.
func (s *Store) Replace(c Catalogue) error {
	if err := c.Validate(); err != nil {
		return err
	}

	skills := slices.Clone(c.Skills)
	if skills == nil {
		// An absent list and an empty one mean the same thing — no skills — but only a
		// list survives the round trip to the browser unambiguously.
		skills = []Skill{}
	}
	sort.Slice(skills, func(i, j int) bool { return skills[i].Name < skills[j].Name })
	c.Skills = skills

	s.mu.Lock()
	defer s.mu.Unlock()
	s.current = c
	s.received = true
	return nil
}

// Snapshot returns the current catalogue, sorted by name, and whether one was ever
// published. The boolean is the difference between a producer with no skills and no
// producer at all — the interface shows a different screen for each.
func (s *Store) Snapshot() (Catalogue, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.received {
		return Catalogue{}, false
	}
	c := s.current
	c.Skills = slices.Clone(c.Skills)
	return c, true
}
