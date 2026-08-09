# Closing the remaining gap with avel-admin.dc.html

## What

Fixes to what the prior sidebar-shell pass got structurally right but still diverged
from the mockup's actual content:

- **Sidebar sections.** "Opérations" (Dossiers, Suivi agent) / "Configuration"
  (Automatisations) — `ViewDef.section`, optional, only set for Avel's view set. Kern's
  own seven views stay an ungrouped flat list: no mockup groups them, so no taxonomy was
  guessed for them.
- **Top bar status pills and avatar.** Real computed counts ("N dossiers actifs", "N
  validations en attente" — `summariseDossiers()` in `AppShell.tsx`, reusing the exact
  same `dossierStatus()` the table uses) and a real avatar (initials from the logged-in
  account), shown only for a brand whose view set actually has a dossiers concept.
- **Dossiers table, real business columns.** "Étape" is now the plain-language name of
  the run's *current* node (`fr.hive.nodeInfo(currentNodeId(run)).name`), not the raw
  graph name. "Statut" is a business status — `waiting` / `active` / `done` / `failed`,
  derived from the run's real state and whether an approval node is currently active
  (`dossierStatus()` in `runs/dossiers.ts`) — not the technical `running`/`finished`/
  `failed` run status. The action button reads "Traiter" (filled, urgent) for a dossier
  waiting on a person, "Ouvrir" (quiet) otherwise — matching the mockup's own
  distinction, not decoration.
- **A `--state-done` token**, added to both `brand-kern.css` and `brand-avel.css`: the
  mockup's "Terminé" status is a genuine fifth colour, not a reuse of the four-state
  repos/réflexion/action/erreur cycle (Avel's own client-view mockup used a real green
  for it, distinct from its blue "en cours").
- **Suivi agent's banner** now carries the same business-status chip as the table row.

## What this deliberately does not fabricate

Two more pieces of the mockup have no real data source at all — building them would mean
inventing content, not implementing a design:

- **The approval panel's bank shortlist.** The mockup shows three named banks with rates.
  `ApprovalPanel` (shared with Kern's own Agents view) reads one free-text field,
  `state.plan_propose` — there is no structured field a skill can populate today.
- **The action log** (a chronological "what the agent actually did," in words).
  `kern.activity/v1` only carries a start/stop boolean per node, no narrative text.

Both are real backend gaps, not implementation debt — documented as **C13** (structured
approval content) and **C14** (narrative activity log) in `docs/expected-contracts.md`,
following that file's own numbering convention, for a session that owns the backend side
of this repo pair. Also flagged there in passing: that file's summary table lists **C6
(steering) as "missing," which looks stale** — the code has a real, tested
dispatch/decide/nudge/stop implementation in active use — not audited or fixed in this
pass, since it's outside what this one touched.

## Verified for real

`tsc -b` clean, 287 front tests green. Real dispatch of two `courtage-extraction` runs
with distinct dossiers against a rebuilt Avel binary, screenshotted: sidebar sections
render, the table shows real plain-language step names and a real computed "Bloqué"
status (both runs genuinely failed at `masquage_pii`), and the top bar's "0 dossiers
actifs" pill is correct — both dossiers are `failed`, not `active`, and the count
reflects that rather than just counting rows.
