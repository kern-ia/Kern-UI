package memory

import (
	"context"
	"fmt"
	"strings"
)

// maxCerveauRoots/maxCerveauDepth bound how much work one BuildCerveau call can trigger
// against kern-memory — a large memory store must not turn one browser request into an
// unbounded fan-out. Mirrors kern-memory's own "never trust the caller past a hard
// server-side cap" precedent (its Depth clamp), applied here on the caller's side since
// kern-ui is itself the caller of the traversal now.
const (
	maxCerveauRoots = 20
	maxCerveauDepth = 2
)

// CerveauNode is one memory as the Cerveau view draws it: id is "kind:originalID" (ids
// have no shared namespace across kern-memory's layers, so the composite is the only
// safe key), label is its text, truncated by the caller if it wants to.
type CerveauNode struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Label string `json:"label"`
}

// CerveauEdge is one directed relationship, ids in the same "kind:originalID" shape as
// CerveauNode.ID so a frontend never has to know kern-memory's own composite-key rule.
type CerveauEdge struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Relation string `json:"relation"`
}

// Cerveau is a ready-to-render neighbourhood — real content only, kern-ui's Cerveau view
// (C7) draws exactly this, never talking to kern-memory's traversal semantics itself.
//
// Roots names which node ids (the "kind:id" composite CerveauNode.ID uses) were the
// traversal's actual starting points — every graph root, or the one focus node on a dive.
// A frontend needs this to lay a graph out around its real center(s); re-deriving it from
// Edges alone (e.g. "a node with no incoming edge") would be a guess, not a fact, on a
// graph that can have cycles or a root with an incoming edge from something else entirely.
type Cerveau struct {
	Nodes []CerveauNode `json:"nodes"`
	Edges []CerveauEdge `json:"edges"`
	Roots []string      `json:"roots"`
}

// BuildCerveau assembles a neighbourhood: from every graph root (kern-memory decision 15
// — an okf memory tagged "cerveau-racine") when focusKind/focusID are empty, the mockup's
// broad initial view; from exactly one node when they're set, C7's "double-clic pour
// plonger" — a fresh view centered there, not merged into what came before.
func (c *Client) BuildCerveau(ctx context.Context, focusKind, focusID string) (Cerveau, error) {
	starts, err := c.cerveauStarts(ctx, focusKind, focusID)
	if err != nil {
		return Cerveau{}, err
	}

	touched := make(map[string]string, len(starts)) // "kind:id" -> kind
	roots := make([]string, len(starts))
	for i, s := range starts {
		key := nodeKey(s.Kind, s.ID)
		touched[key] = s.Kind
		roots[i] = key
	}

	// A list, not nil, even when empty — an absent list and an empty one mean the same
	// thing here, but only a list survives the JSON round trip to the browser
	// unambiguously (the exact gotcha internal/registry.Store.Replace already documents;
	// a real crash was hit live diving into a leaf node with no outgoing edges before
	// this fix, "edges is not iterable" against a bare `null`).
	edges := []CerveauEdge{}
	seenEdges := make(map[string]bool)
	for _, s := range starts {
		recalls, err := c.QueryMemory(ctx, MemoryQuery{Kind: "graph", FromKind: s.Kind, FromID: s.ID, Depth: maxCerveauDepth})
		if err != nil {
			return Cerveau{}, fmt.Errorf("memory: cerveau traversal from %s:%s: %w", s.Kind, s.ID, err)
		}
		for _, r := range recalls {
			e := r.Memory
			key := e.FromKind + ":" + e.FromID + "->" + e.ToKind + ":" + e.ToID + ":" + e.Relation
			if seenEdges[key] {
				continue
			}
			seenEdges[key] = true
			edges = append(edges, CerveauEdge{From: nodeKey(e.FromKind, e.FromID), To: nodeKey(e.ToKind, e.ToID), Relation: e.Relation})
			touched[nodeKey(e.FromKind, e.FromID)] = e.FromKind
			touched[nodeKey(e.ToKind, e.ToID)] = e.ToKind
		}
	}

	nodes, err := c.resolveCerveauNodes(ctx, touched)
	if err != nil {
		return Cerveau{}, err
	}
	return Cerveau{Nodes: nodes, Edges: edges, Roots: roots}, nil
}

// cerveauStarts returns the traversal's starting points: the one focus node if given, or
// every root (capped at maxCerveauRoots) otherwise.
func (c *Client) cerveauStarts(ctx context.Context, focusKind, focusID string) ([]Memory, error) {
	if focusID != "" {
		return []Memory{{Kind: focusKind, ID: focusID}}, nil
	}
	recalls, err := c.QueryMemory(ctx, MemoryQuery{Kind: "okf", Tags: []string{"cerveau-racine"}})
	if err != nil {
		return nil, fmt.Errorf("memory: cerveau roots: %w", err)
	}
	if len(recalls) > maxCerveauRoots {
		recalls = recalls[:maxCerveauRoots]
	}
	out := make([]Memory, len(recalls))
	for i, r := range recalls {
		out[i] = Memory{Kind: "okf", ID: r.Memory.ID}
	}
	return out, nil
}

// resolveCerveauNodes turns a touched (kind:id -> kind) set into labeled nodes, one
// resolve call per kind rather than per id. A memory that no longer resolves (deleted,
// or an edge referencing a mistake) keeps its raw id as a fallback label instead of
// disappearing from the view or failing the whole request.
func (c *Client) resolveCerveauNodes(ctx context.Context, touched map[string]string) ([]CerveauNode, error) {
	byKind := map[string][]string{}
	for key, kind := range touched {
		byKind[kind] = append(byKind[kind], originalID(key))
	}

	labels := map[string]string{} // "kind:id" -> label
	for kind, ids := range byKind {
		recalls, err := c.QueryMemory(ctx, MemoryQuery{Kind: kind, IDs: ids})
		if err != nil {
			return nil, fmt.Errorf("memory: cerveau resolve %s ids: %w", kind, err)
		}
		for _, r := range recalls {
			labels[nodeKey(kind, r.Memory.ID)] = r.Memory.Text
		}
	}

	nodes := make([]CerveauNode, 0, len(touched))
	for key, kind := range touched {
		label, ok := labels[key]
		if !ok {
			label = originalID(key)
		}
		nodes = append(nodes, CerveauNode{ID: key, Kind: kind, Label: label})
	}
	return nodes, nil
}

func nodeKey(kind, id string) string { return kind + ":" + id }

// originalID recovers the id half of a "kind:id" key. SplitN with a limit of 2 keeps any
// colon that happens to be part of the id itself intact — only the first separator counts,
// since Kind values (okf/vector) never contain one.
func originalID(key string) string {
	parts := strings.SplitN(key, ":", 2)
	if len(parts) == 2 {
		return parts[1]
	}
	return key
}
