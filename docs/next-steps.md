# Where kern-ui stands, and what comes next

Written 2026-07-26, updated 2026-07-27 when the skills registry shipped. Read this plus
[`docs/index/`](index/) to pick the work back up without re-reading the code.

---

## State

**kern-ui** — `dev`, 13 features merged, 105 front tests + 4 Go packages green, `main` still
at the baseline commit.

**kern-orch** — `dev`, 8 packages green, `main` behind `dev`.

Neither `dev` has been merged to `main`. That is a deliberate pause, not an oversight: merge
when you want a stable milestone.

### What runs

```sh
make build && KERN_UI_WEB_DIR=internal/httpapi/dist ./bin/kern-ui   # → :7777
cd ../Kern-Orch && KERN_STEP_REPORT_URL=http://127.0.0.1:7777/api/v1/steps \
  KERN_REGISTRY_REPORT_URL=http://127.0.0.1:7777/api/v1/registry \
  KERN_ACTIVITY_REPORT_URL=http://127.0.0.1:7777/api/v1/activity go run . run examples/hello.yaml
```

- Six-tab shell (Cerveau · Agents · Espace · Navigateur · Rédaction · Grimoire), four tabs on
  mobile, matching the mockup.
- **Agents** draws a run as the mockup's hive — nodes coloured by state, edges animated into
  what is running, dashed stub where a router decides at run time.
- **Grimoire** draws the skills catalogue kern-orch publishes: competences left, sub-agents
  right, each sub-agent coloured by whether a run is exercising it right now.
- The four unfed views name the brick or the contract they wait for. They render no data on
  purpose, and a test enforces that. The Espace now names C5 rather than kern-orch: it has
  the catalogue, it lacks the readings.
- Floating conversation on a draggable rune stone, dockable to either edge, position
  persisted. Inert: there is nothing to talk to yet.
- Contracts `kern.step-event/v2`, `kern.registry/v1` and `kern.activity/v1` in use, with
  executable fixtures asserted from both repos.
- The beacon reaches all four of its colours: a run opens the moment an agent starts working,
  and `Réflexion` is lit for as long as a model is.

---

## Decisions carried forward

| Subject | Decision |
|---|---|
| UI backend | **Go for this version.** Confirmed 2026-07-26 after weighing Tauri. |
| Tauri | **Likely later, not now.** Re-evaluate against the two criteria below. |
| Rust in the ecosystem | Right tool for `kern-exec` / `kern-guard` / `kern-policy` — they touch syscall-level confinement, which Go handles badly (runtime thread multiplexing vs per-thread seccomp, cgo needed, breaks pure cross-compilation). |
| Art direction | Grimoire Ambré confirmed. The other two mockups would cost only a `tokens.css`. |
| MCP servers | Not a brick — tools/skills the agent wires on demand. Same registry as the Grimoire. |

### What would settle the Tauri question

Two questions, neither answered yet. Answering them decides it; arguing does not.

1. **What must mobile actually do?** Consultation only → today's PWA is enough. Store
   presence and reliable push → Tauri wins.
2. **Must policy enforcement share a process with the approval surface?** If yes, a single
   signed binary holding UI + policy + guard is coherent and Tauri serves it. If the bricks
   stay separate processes talking by contract, it buys nothing.

Nothing built so far is wasted either way: a Tauri shell wraps this same SPA.

---

## Next, in order

### 1. `kern-exec` — confinement · **urgent, independent of everything else**

A kern-orch agent today has no limit beyond the user account it runs under. It spawns the
provider CLI as a subprocess with full rights: shell, filesystem, network.

This is a hole that exists **now**, whatever the interface is written in. It is also the one
piece of work where Rust is clearly the better tool.

Belongs to `kern-exec` (⬜ in the roadmap), with `kern-guard` (blocking guardrail) and
`kern-policy` (rules, budgets, escalation) beside it.

### 2. Authentication and TLS on the kern-ui API

`_à décider_` in CLAUDE.md since the start, and the only thing standing between the current
binary and a machine other than yours. Verified: `KERN_UI_ADDR=0.0.0.0:7777` already serves
a remote kern-orch correctly — but with no auth, anyone reachable can read every run and
inject fake ones.

It stops being optional the moment more than one person uses it. See the open question below.

### 3. `C5` — tool invocation and readback · **blocked on a process, not a contract**

Since C4 shipped, this is all that stands between the Espace and its widgets. But it cannot
be built yet, and the reason is structural rather than a missing schema.

A widget value refreshes on a clock, independently of runs. **kern-orch is a CLI**: between
two graphs no kern-orch process is alive, so there is nothing to push and nothing to poll.
Reading tools from kern-ui instead would give the interface a second producer *and* teach it
how to invoke a tool, which is kern-tools' job.

The prerequisite is already on kern-orch's own roadmap: **EPIC-03, "exposition MCP/API des
tools (un service unique)"**, sized L. Until something long-running exposes the tools, C5 has
no producer that can run.

Two ways forward, both deliberate choices rather than defaults: do EPIC-03, or ship widgets
with an explicit staleness ("12 — il y a 3 h") that only move when a graph runs.

### 4. `C10` — done

Shipped 2026-07-27. Half of it needed no contract at all: `Tension` was already reachable
from the failure C3 carries, and the code had simply not caught up.

### 5. Everything else

`C6` steering (kern-pilot — the conversation stone, accept/ignore), `C7` memory graph, `C8`
documents, `C9` browser session and approval queue, and `C11` skill authoring — which is a
team decision before it is work. All stated in the contracts report.

---

## Open questions, to answer before building

Stated in plain language, for a team discussion rather than an implementer, in
[`a-trancher.md`](a-trancher.md) — which covers the whole set, including the ones that live
in the ordered list above.

**Does Kern-IA become multi-user?** CLAUDE.md says *"Usage interne Kern, pas de produit
multi-comptes"*. The question "can one agent receive tasks from several employees" makes
that line false if the answer is yes, and it changes:

- `Run` gains an owner — the field does not exist today;
- a queue per agent, with arbitration between submitters (`kern-pilot`);
- who may steer what (`kern-policy`);
- authentication becomes mandatory, not `_à décider_`;
- the conversation stone becomes per-user, not global.

**This premise gates items 2, 5 and part of 3.** It is a product decision, not a technical
one. Answer it before writing `kern-pilot`.

**Who owns the authoring of skills and sub-agents?** Raised 2026-07-27, on the back of C4.
A sub-agent is a skill with `type: agent` — one field, one flat directory, read-only. Nothing
can create one, so the storage question only bites for a sub-agent that is *created*.

Three decisions, entangled, stated in full in
[`docs/expected-contracts.md`](expected-contracts.md) as **C11**:

1. one tier or two — shipped skills versus created ones;
2. who writes — recommendation: kern-pilot commands, kern-orch writes, because whoever reads
   a directory should be the one who writes it;
3. the multi-user question below, which decides whether a created sub-agent needs an owner.

**This is a team decision, not a technical one.** It blocks the Grimoire's `+`, nothing else
— C5 and C10 are read paths and proceed without it.

**Should `dev` merge to `main`?** Both repos have unmerged work. A milestone tag would make
the Tauri re-evaluation easier to reason about later.

---

## Known gaps, deliberately left

- **No persistence.** Restarting kern-ui empties the projection. Assumed: kern-orch stays
  authoritative. The day finished-run history matters, ask kern-orch for it — do not copy it
  here.
- **Mobile never verified visually.** `resize_window` reports success and does not resize
  the window — confirmed again on 2026-07-27. The one-column layouts rest on a media query
  at 720 px. Check on a real phone.
- **The Grimoire has no avatars.** The mockup shows a generative avatar per sub-agent;
  nothing generates one, so the skill's rune stands in. A placeholder image would be
  decoration pretending to be data.
- **Creating a skill or a sub-agent is inert.** The mockup's `+` is drawn, disabled, and
  says it waits for kern-pilot — same treatment as the conversation bar.
- **Sub-graph nodes draw as single nodes.** Nesting the child's hive needs the child's
  topology, which nothing sends.
- **The reporter is synchronous** in kern-orch: a slow sink slows the graph, capped at 2 s
  per level.
