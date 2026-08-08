# Avel Finances advisor console — real views, not a reskin

## What

Three real views for the Avel brand, replacing Kern's seven tabs entirely (not
relabelling them): **Dossiers** (a list, grouping runs by the new `dossier` field —
`web/src/dossiers/DossiersView.tsx`), **Suivi agent** (one dossier's current run, timeline
+ approval —`web/src/dossiers/DossierDetailView.tsx`), and **Automatisations** (the
existing `GrimoireView`, reused as-is). Selected at build time
(`VITE_BRAND=avel`), same doctrine as the token/copy layers before it — see
`shell/views.ts`'s `activeViews()`/`defaultView()`.

## Why this, now

The project owner caught, directly, that everything built in the two prior sessions
(tokens, copy) only reskinned the *existing* app — none of the validated mockups'
layouts (`design/mockups/avel-client.dc.html`, `avel-admin.dc.html`) existed as real
components. This closes that gap for the advisor side. The client-facing dossier page
(an end client seeing only their own case) stays out of scope — it needs real
per-account visibility, which nothing in `internal/httpapi` does today
(`handleListRuns` returns every run to every signed-in account, no role concept exists
in `internal/auth` at all) — a security decision for later, not something to improvise
here.

## Reused, not duplicated

- `HiveGraph`/`hive.ts` (the horizontal-timeline layout engine, built earlier this
  session) draws `DossierDetailView`'s timeline exactly as it draws `AgentsView`'s.
- `AgentsView`'s `ApprovalPanel` is now exported and reused directly in
  `DossierDetailView` rather than re-implemented — the underlying approval mechanism
  (`decide()`) is identical for every brand; only the surrounding chrome differs.
- `GrimoireView` needs zero changes for "Automatisations" — `avel.ts`'s copy overrides
  from the prior session (`grimoire.competences/subAgents/label`) already covered it.
  Checked live against real registry data (not assumed): reads correctly, real skill
  cards, real descriptions.

## Real backend work, not a frontend-only pass

`dossier` is a new field, mirroring `requester`'s exact plumbing in both this repo and
`Kern-Orch` — see `docs/index/dossier-field.md` and
`Kern-Orch/docs/index/0037-dossier-field.md`. The project owner explicitly chose this
over reusing `requester` (an identity used for a steering-permission check, not a
grouping key).

## Verified for real

End-to-end, not just unit tests: built real `kern-orch`/`kern-ui` binaries, dispatched a
real `courtage-extraction` run with `dossier: "AF-2288"` through the actual HTTP API,
confirmed the field survived the whole round trip (`StepEvent` → projection → `Run`
JSON), and drove the running Avel build in a real browser — the dossier appeared in the
list, its detail view drew the real Hive timeline with the courtage-extraction node
copy added earlier this session, and Automatisations rendered the real published skills
catalogue after a real `publish-skills` call. `tsc -b` clean, 279 front tests green (4
for `groupByDossier`, 8 for `DossiersView`/`DossierDetailView`), all Go packages green
in both repos.

## Left open, on purpose

- The Hive timeline's wide-graph layout (courtage-extraction has 18 nodes) wraps into a
  second stacked column visually — pre-existing `hive.ts` behavior, unrelated to this
  work, not fixed here.
