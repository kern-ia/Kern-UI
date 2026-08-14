# C7 — The Cerveau view: memory graph, frontend (Kern-UI half)

## What

`cerveau` flips from `awaiting` to `live` in `web/src/shell/views.ts` — the Grimoire's
sibling in the sidebar, a real navigable graph instead of the "not built" notice. Backend
half already documented in `docs/index/` for this pass: `internal/memory/cerveau.go`'s
`BuildCerveau` (kern-orch-side write path lives in kern-memory's own repo, see its
`docs/planning/specs/15-graph-roots.md` and `16-resolve-by-id.md`), exposed at
`GET /api/v1/cerveau` (`internal/httpapi/memory.go`'s `handleCerveau`).

Frontend (`web/src/cerveau/`): `useCerveau.ts` fetches (loading/unconfigured/error/ready,
same shape as `useCriteria.ts`), `cerveau.ts` is pure radial layout (root(s) at/near
center, each further hop its own ring — a real BFS over the edges, not a force-directed
simulation, matching HiveGraph's own "no charting dependency" posture), `CerveauView.tsx`
draws it as SVG with HiveGraph's fixed-step zoom convention reused verbatim. Double-click
a node re-fetches `?from=<kind>:<id>` and replaces the view (C7's "double-clic pour
plonger"); a "Revenir à la vue d'ensemble" link clears the focus back to the broad
initial view.

## Why

`docs/expected-contracts.md`'s C7 was corrected earlier this session from a stale
`kern-memory ⬜` to what was actually missing: kern-ui's client, node-content resolution,
a roots concept, and — until now — the view itself. This closes the last piece.

## A real bug found live, not in a test

`BuildCerveau` declared `var edges []CerveauEdge` — a nil Go slice when a node has no
outgoing edges (the common case diving into a leaf). `encoding/json` marshals nil as
`null`, and the frontend's `cerveau.edges.map(...)` threw `TypeError: e.edges is not
iterable`, caught by double-clicking a real leaf node in a real browser — not by any unit
test, none of which asserted on the *marshaled* shape, only on `len()`, which nil and an
empty slice both satisfy identically. Fixed (`edges := []CerveauEdge{}`) and given its own
regression test (`TestBuildCerveauNeverMarshalsANilEdgesList`, asserting on the actual
JSON bytes) — the same "absent list vs. empty list" gotcha `internal/registry.Store`
already documents and defends against, just not yet applied here before this.

## Verified for real

`go build ./...`/`go test ./...` green, `tsc -b` clean, 331 front tests green (was 320).
`AppShell.test.tsx`'s "switches view on click" test for Cerveau updated from asserting the
old "not built" notice to asserting the real loading state — the view genuinely fetches
now.

**Real E2E**: a real `kern-memory` and a real `kern-ui`, two real OKF roots
(`cerveau-racine` tag) and a real vector memory connected by two real graph edges, written
through `POST /api/v1/memory/write` — no fixtures. Opened Cerveau in a real browser: "3
souvenirs actifs", both roots and the satellite node with their real labels and real
edges. Zoomed (+), double-clicked the satellite to dive — a real second fetch, "1 souvenir
actif", the node alone, no crash (confirmed via the browser's own console, first
reproducing the nil-slice crash, then confirming it gone after the fix and a backend
rebuild — no frontend rebuild needed, the bug was server-side). "Revenir à la vue
d'ensemble" returned to the full three-node view.

## Left open, on purpose

- No persistent view state across a page reload (focus resets to the broad overview) —
  not asked for, and the mockup's own annotation is about continuity *within* a session's
  zoom/dive, not surviving a refresh.
- No visual distinction beyond a colour per kind (okf/vector) — the mockup's own Cerveau
  screen doesn't distinguish memory kinds visually either, so nothing here invents a
  legend the source material never asked for.
