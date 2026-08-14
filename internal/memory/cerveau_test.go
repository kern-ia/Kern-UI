package memory

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeKernMemory answers a fixed script keyed by what the request body asks for — good
// enough to exercise BuildCerveau's real sequence of calls without a real kern-memory.
func fakeKernMemory(t *testing.T, script func(MemoryQuery) []Recall) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q MemoryQuery
		_ = json.NewDecoder(r.Body).Decode(&q)
		_ = json.NewEncoder(w).Encode(script(q))
	}))
}

func TestBuildCerveauFromRootsThenTraversesAndResolvesLabels(t *testing.T) {
	km := fakeKernMemory(t, func(q MemoryQuery) []Recall {
		switch {
		case len(q.Tags) == 1 && q.Tags[0] == "cerveau-racine":
			return []Recall{{Memory: Memory{ID: "root-1", Kind: "okf", Text: "Idée produit"}, Similarity: 1}}
		case q.Kind == "graph" && q.FromKind == "okf" && q.FromID == "root-1":
			return []Recall{{Memory: Memory{
				Kind: "graph", FromKind: "okf", FromID: "root-1", ToKind: "vector", ToID: "vec-1", Relation: "mène-à",
			}, Similarity: 1}}
		case q.Kind == "okf" && len(q.IDs) == 1 && q.IDs[0] == "root-1":
			return []Recall{{Memory: Memory{ID: "root-1", Kind: "okf", Text: "Idée produit"}, Similarity: 1}}
		case q.Kind == "vector" && len(q.IDs) == 1 && q.IDs[0] == "vec-1":
			return []Recall{{Memory: Memory{ID: "vec-1", Kind: "vector", Text: "Recherche client"}, Similarity: 1}}
		}
		return nil
	})
	defer km.Close()

	c := &Client{BaseURL: km.URL}
	got, err := c.BuildCerveau(context.Background(), "", "")
	if err != nil {
		t.Fatalf("BuildCerveau: %v", err)
	}

	if len(got.Nodes) != 2 {
		t.Fatalf("nodes = %+v, want 2", got.Nodes)
	}
	labels := map[string]string{}
	for _, n := range got.Nodes {
		labels[n.ID] = n.Label
	}
	if labels["okf:root-1"] != "Idée produit" || labels["vector:vec-1"] != "Recherche client" {
		t.Errorf("labels = %+v", labels)
	}
	if len(got.Edges) != 1 || got.Edges[0].From != "okf:root-1" || got.Edges[0].To != "vector:vec-1" || got.Edges[0].Relation != "mène-à" {
		t.Errorf("edges = %+v", got.Edges)
	}
}

// Diving into a node (double-click, C7): a focus id replaces the roots query entirely.
func TestBuildCerveauFromAFocusNodeSkipsTheRootsQuery(t *testing.T) {
	var sawRootsQuery bool
	km := fakeKernMemory(t, func(q MemoryQuery) []Recall {
		if len(q.Tags) == 1 && q.Tags[0] == "cerveau-racine" {
			sawRootsQuery = true
		}
		switch {
		case q.Kind == "graph" && q.FromID == "vec-1":
			return nil // a leaf: no outgoing edges
		case q.Kind == "vector" && len(q.IDs) == 1 && q.IDs[0] == "vec-1":
			return []Recall{{Memory: Memory{ID: "vec-1", Kind: "vector", Text: "Recherche client"}, Similarity: 1}}
		}
		return nil
	})
	defer km.Close()

	c := &Client{BaseURL: km.URL}
	got, err := c.BuildCerveau(context.Background(), "vector", "vec-1")
	if err != nil {
		t.Fatalf("BuildCerveau: %v", err)
	}
	if sawRootsQuery {
		t.Error("a focus dive should never query for roots")
	}
	if len(got.Nodes) != 1 || got.Nodes[0].ID != "vector:vec-1" {
		t.Errorf("nodes = %+v, want just the focus node", got.Nodes)
	}
}

// A node reached by an edge but never written to either layer (deleted, or a data
// mistake) gets a fallback label rather than disappearing or erroring the whole view.
func TestBuildCerveauFallsBackToTheRawIDWhenAReferencedMemoryCannotBeResolved(t *testing.T) {
	km := fakeKernMemory(t, func(q MemoryQuery) []Recall {
		switch {
		case len(q.Tags) == 1 && q.Tags[0] == "cerveau-racine":
			return []Recall{{Memory: Memory{ID: "root-1", Kind: "okf", Text: "Racine"}, Similarity: 1}}
		case q.Kind == "graph" && q.FromID == "root-1":
			return []Recall{{Memory: Memory{
				Kind: "graph", FromKind: "okf", FromID: "root-1", ToKind: "vector", ToID: "disparu", Relation: "mène-à",
			}, Similarity: 1}}
		case q.Kind == "okf" && len(q.IDs) == 1 && q.IDs[0] == "root-1":
			return []Recall{{Memory: Memory{ID: "root-1", Kind: "okf", Text: "Racine"}, Similarity: 1}}
		case q.Kind == "vector":
			return nil // "disparu" never resolves
		}
		return nil
	})
	defer km.Close()

	c := &Client{BaseURL: km.URL}
	got, err := c.BuildCerveau(context.Background(), "", "")
	if err != nil {
		t.Fatalf("BuildCerveau: %v", err)
	}

	var found bool
	for _, n := range got.Nodes {
		if n.ID == "vector:disparu" {
			found = true
			if n.Label != "disparu" {
				t.Errorf("label = %q, want the raw id as a fallback", n.Label)
			}
		}
	}
	if !found {
		t.Error("the unresolved node is missing entirely, want it kept with a fallback label")
	}
}

func TestBuildCerveauWithNoRootsIsAnEmptyViewNotAnError(t *testing.T) {
	km := fakeKernMemory(t, func(MemoryQuery) []Recall { return nil })
	defer km.Close()

	c := &Client{BaseURL: km.URL}
	got, err := c.BuildCerveau(context.Background(), "", "")
	if err != nil {
		t.Fatalf("BuildCerveau: %v", err)
	}
	if len(got.Nodes) != 0 || len(got.Edges) != 0 {
		t.Errorf("got %+v, want an empty graph", got)
	}
}
