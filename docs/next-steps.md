# Where kern-ui stands, and what comes next

Written 2026-07-26, updated 2026-07-27 when the skills registry shipped. Read this plus
[`docs/index/`](index/) to pick the work back up without re-reading the code.

---

## State

**kern-ui** — `dev`, 14 features merged, 117 front tests + 4 Go packages green, `main` still
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
| Users | **Multi-user.** Decided 2026-07-28: several people at once, enterprise use. |
| Authentication | **Mandatory**, individual accounts. Decided 2026-07-28. |
| kern-orch's nature | **A daemon**, not a command. Decided 2026-07-28. |
| Confinement | **A sandbox**, control kept outside the agent. Decided 2026-07-28. |
| Creating sub-agents | **Out of the POC**, deferred. Kern team only at first; headed towards a no-code node editor. Decided 2026-07-28. |
| Identities | **Kern-owned accounts first**; the company directory becomes interesting past ~5 employees per client. Decided 2026-07-28. |
| Mobile | **No native shell, no push of our own.** The phone reacts through a messaging app the client already uses. Decided 2026-07-28. |
| Tauri | **Not needed for notifications.** One of its two criteria is now void; the other one stands. |
| Tauri | **Likely later, not now.** Re-evaluate against the two criteria below. |
| Rust in the ecosystem | Right tool for `kern-exec` / `kern-guard` / `kern-policy` — they touch syscall-level confinement, which Go handles badly (runtime thread multiplexing vs per-thread seccomp, cgo needed, breaks pure cross-compilation). |
| Art direction | Grimoire Ambré confirmed. The other two mockups would cost only a `tokens.css`. |
| MCP servers | Not a brick — tools/skills the agent wires on demand. Same registry as the Grimoire. |

### The Tauri question, mostly closed

Two criteria stood. **The first is void as of 2026-07-28**: mobile does not need a reliable
push of our own, because notifications go out through Telegram, Slack or WhatsApp — a
messaging app the client already has. No store presence, no push tokens, no encrypted
transport to build.

**The second stands, and got sharper.** Must policy enforcement share a process with the
approval surface? Remote control is now confirmed scope, so an approval surface *will* exist
— and it will exist in a chat as well as in the interface, which arguably settles it the
other way: an approval that can arrive from WhatsApp cannot be enforced by a binary sharing
its process. Worth thinking through rather than declaring.

Nothing built so far is wasted either way: a Tauri shell wraps this same SPA.

## Next, in order

### 1. `kern-exec` — confinement · **urgent, independent of everything else**

A kern-orch agent today has no limit beyond the user account it runs under. It spawns the
provider CLI as a subprocess with full rights: shell, filesystem, network.

This is a hole that exists **now**, whatever the interface is written in. It is also the one
piece of work where Rust is clearly the better tool.

Belongs to `kern-exec` (⬜ in the roadmap), with `kern-guard` (blocking guardrail) and
`kern-policy` (rules, budgets, escalation) beside it.

### 2. Authentication on the kern-ui API · **decided, and it is our brick**

No longer `_à décider_`: individual accounts, mandatory. Verified long ago that
`KERN_UI_ADDR=0.0.0.0:7777` serves a remote kern-orch correctly — and that with no auth,
anyone reachable reads every run and can inject fake ones.

**This is the first item on this list that belongs to kern-ui itself**, which makes it the
natural next piece of work here. Two things travel together and should not be split:

- a caller must prove who it is, on both the ingestion endpoints and the read ones;
- a run must carry **who asked for it**. That field does not exist, and every run recorded
  without it is a run that can never be attributed. It costs one field today and a migration
  later.

One question surfaces at implementation rather than before: where identities come from —
accounts owned by Kern, or the company's directory. Worth answering before writing, not
before planning.

### 3. `C5` — tool invocation and readback · **unblocked by the daemon decision**

Since C4 shipped, this is all that stands between the Espace and its widgets. But it cannot
be built yet, and the reason is structural rather than a missing schema.

A widget value refreshes on a clock, independently of runs. **kern-orch is a CLI**: between
two graphs no kern-orch process is alive, so there is nothing to push and nothing to poll.
Reading tools from kern-ui instead would give the interface a second producer *and* teach it
how to invoke a tool, which is kern-tools' job.

**Decided 2026-07-28: kern-orch becomes a daemon.** That is exactly the missing prerequisite,
and it retires the fallback of shipping widgets with an explicit staleness. C5 now waits on
work rather than on a choice — the daemon first, over in kern-orch (EPIC-03, sized L), then
this contract on top of it.

### 4. `C10` — done

Shipped 2026-07-27. Half of it needed no contract at all: `Tension` was already reachable
from the failure C3 carries, and the code had simply not caught up.

### 5. `C12` — the messaging channel · **new, and it displaces mobile work**

The phone reacts through Telegram, Slack or WhatsApp rather than through anything we build.
Telegram is the cheap first step — a bot and a token, the whole loop provable in a day — and
it is *not* proof that WhatsApp will follow easily: that one needs a verified Meta business
account and pre-approved templates for anything we initiate, billed per conversation. The
irony to accept is that the app SMEs already have is the hardest of the three to ship.

Two things need answering before this ships, neither of them ours alone: whether a critical
approval may be given by chat at all, and where a company's data is allowed to transit.
Stated in [`docs/expected-contracts.md`](expected-contracts.md) as C12.

### 6. Everything else

`C6` steering (kern-pilot — the conversation stone, accept/ignore, and now the chat surface
too), `C7` memory graph, `C8` documents, `C9` browser session and approval queue, and `C11`
authoring — deferred, and headed towards a no-code node editor rather than skill files. All
stated in the contracts report.

---

## Answered, 2026-07-28

The brainstorming (`brainstorming_28_07_2026.html`) settled five of the seven questions this
file used to carry. Stated in plain language, with what follows from each, in
[`a-trancher.md`](a-trancher.md).

| Question | Answer | What it changes here |
|---|---|---|
| Multi-user? | **Yes** — several people at once | A run must carry who asked for it. The field does not exist. Authentication stops being optional. |
| Authentication | **Mandatory**, individual accounts | Promoted to the top of the ordered list below |
| Confinement | **Sandbox**, control kept outside | `kern-exec` confirmed, at its full scope rather than a quick restriction |
| Tools always available? | **Yes — kern-orch becomes a daemon** | Unblocks C5, and changes what kern-orch *is* |
| Creating sub-agents | **Deferred**, out of the POC | C11 stays unanswered on purpose; the Grimoire's `+` stays disabled by decision |
| Where identities come from | **Kern accounts first** | Directory/SSO is a door to leave open, not to build |
| How the phone reacts | **Through an existing messaging app** | Removes native push from the roadmap; adds C12 |

Also confirmed as scope rather than a question: **remote control** — stop an agent, approve
or refuse one of its decisions, trigger a simple action. That is C6, `kern-pilot`.

**Still open.** The milestone below. How wide the sandbox is. Whether a critical approval may
be given by chat at all, and where a company's data may transit — both C12, both needing
someone other than this repo to answer.

**One correction this forces.** CLAUDE.md said *"Usage interne Kern, pas de produit
multi-comptes"*. That is now false and has been rewritten. It was the premise under several
choices already made — anything resting on it deserves a second look.

**Should `dev` merge to `main`?** Still unanswered, and now worth more than before: the three
chantiers ahead — sandbox, authentication, daemon — will move a great deal at once. A marked
point to come back to costs almost nothing today.

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
