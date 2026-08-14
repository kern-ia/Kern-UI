# C11 — Sub-agent creation, Kern-UI half: the Grimoire's no-code editor

## What

The Grimoire's `+` for sub-agents (`web/src/grimoire/GrimoireView.tsx`) is real: it opens
`CreateAgentEditor.tsx`, a modal producing a linear chain of Agent steps (name +
instructions each), submitted to kern-orch's new write path (`Kern-Orch/docs/index/
0040-sub-agent-creation.md`) via `internal/steer/client.go`'s `CreateSkill`/`DeleteSkill`
and matching `internal/httpapi` handlers — same pattern as every other C6 write path
(`stop`/`nudge`/`decide`/`dispatch`): the browser never sends who is asking, kern-ui's
session does. Each custom sub-agent in the Grimoire carries a delete control, shown only
to the account `created_by` names — a display convenience only, since kern-orch itself
re-checks ownership on every delete regardless of what the button shows.

The tool-skill `+` (left column) stays disabled: a no-code editor cannot author the Go
command a tool skill needs, and that was never in scope here.

## Why

`docs/a-trancher.md` §4 explicitly deferred this 2026-07-28 ("hors POC… rien n'est à
construire maintenant"). The project owner reopened it this session and walked through
its four open questions (editor shape, storage tiers, who writes, ownership) before any
code — see `Kern-Orch/docs/index/0040-sub-agent-creation.md` for the full record, since
the answers apply to both halves of this feature.

## A wire gap found and closed mid-build

`kern.registry/v1`'s `CatalogueEntry` was deliberately narrower than `skills.Skill` — but
without `custom`/`created_by` crossing that contract, the Grimoire has no way to know
which entries are ever deletable, or by whom. Extended both sides additively
(`Kern-Orch/docs/index/0041-registry-custom-fields.md`) — and found, while doing it, that
`internal/registry`'s ingestion handler uses `DisallowUnknownFields()`: without adding
these fields to kern-ui's own `registry.Skill` too, the **whole catalogue publish** would
have started failing the moment any custom skill existed, not just silently dropping the
new fields. Caught and fixed before it could ship broken.

## `useRegistry`'s one deliberate exception

The hook's own comment says a registry is fetched, never subscribed to — a catalogue
changes when a skill is installed, not when a graph advances. Creating or deleting a
sub-agent is exactly that "installed" case, though, and kern-orch republishes
synchronously before answering the create/delete request. Added an optional `refreshKey`
parameter (bump it, the effect re-runs) rather than turning the hook into a subscription —
every existing caller passing only a URL is unaffected.

## Verified for real

`go build ./...`/`go test ./...` green on Kern-UI (httpapi, registry, steer — including
the `DisallowUnknownFields` round-trip and the actor-never-from-the-body tests), 320 front
tests green (was 308), `tsc -b` clean.

**Real E2E, both repos live, in an actual browser**: logged in as a real account
(`elise`), opened the Grimoire, filled the no-code editor with a real two/one-step
sub-agent, submitted — the SKILL.md landed on disk with `created_by: elise`, the card
appeared in the Grimoire with no manual refresh (the `refreshKey` republish path), and
`/accueil-client texte…` in the conversation stone launched and finished a real run with
zero daemon restart. Ownership checked from both directions: a second real account
(`bruno`, curled with its own session cookie) got a real 403 with the file untouched;
`elise` deleted it for real through the UI and the directory disappeared.

## Left open, on purpose

- No branching/human-validation node — the router constraint documented on the Kern-Orch
  side, not attempted here.
- No free-form drag-to-reorder — steps are ordered with buttons, since a straight line is
  the only shape kern-orch's write path can express today; a real canvas with wiring is a
  question for once branching exists at all.
- No role system — "any signed-in account creates, only the creator deletes" is the whole
  ownership model, matching what the project owner actually decided.
