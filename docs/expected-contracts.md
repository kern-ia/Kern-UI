# Contracts kern-ui expects

What the interface needs in order to stop showing "this view waits for a brick", where each
piece of data must come from, and what exists today.

Derived from `design/mockups/*.dc.html` (the six views and their transverse elements) and
from the brick map in `../Kern-Orch/docs/ROADMAP.md`.

**Deciding rather than building?** [`a-trancher.md`](a-trancher.md) states the same open
questions in plain language, for the people who answer them rather than the people who
implement them. When a decision is taken there, record it here. Statuses use the roadmap's own legend:
✅ done · 🟡 partial · ⬜ to do · 🔌 external.

Nothing here is a proposal for a payload shape yet — except where marked **drafted**, these
are statements of need. The one contract that exists is specified in [README.md](../README.md).

---

## Summary

| # | Contract | Producer | Unlocks | Status |
|---|---|---|---|---|
| C1 | `kern.step-event/v1` — level transitions | kern-orch ✅ | Agents (partial), beacon (partial) | **in use** |
| C2 | Run topology — nodes and edges | kern-orch ✅ | Agents as the mockup draws it | **in use** |
| C3 | Run failure | kern-orch ✅ | Agents node colours, failed runs | **in use** |
| C4 | `kern.registry/v1` — skills & tools registry | kern-orch ✅ | Grimoire | **in use** |
| C5 | Tool invocation and readback | kern-tools 🟡 | Espace widget values | missing |
| C6 | Steering channel | kern-pilot ⬜ | Conversation, sub-agent creation, accept/ignore | missing |
| C7 | Memory graph | kern-memory ⬜ | Cerveau | missing |
| C8 | Documents and suggestions | kern-memory ⬜ + kern-pilot ⬜ | Rédaction | missing |
| C9 | Browser session and approval queue | kern-exec ⬜ + kern-pilot ⬜ | Navigateur | missing |
| C10 | `kern.activity/v1` — live activity signal | kern-orch ✅ | `Réflexion` beacon | **in use** |
| C11 | Skill & sub-agent authoring | undecided | `Nouveau sous-agent`, `+` compétence | **deferred; may become graph authoring** |
| C12 | Messaging channel — notify and be commanded | kern-pilot ⬜ + an external platform 🔌 | Phone reacting; a second command surface | **scope confirmed 2026-07-28** |

**C11 was added on 2026-07-27**, from building C4: it is the first entry on this list that
is a decision before it is a schema, and it is stated so nobody has to rediscover it.

**C2 and C3 shipped on 2026-07-26** as `kern.step-event/v2`: the Agents view draws the hive
the mockup shows. **C4 shipped on 2026-07-27** as `kern.registry/v1`: the Grimoire is live.
**C10 shipped on 2026-07-27** as `kern.activity/v1`: the beacon reaches all four of its
colours. **C5** is the next one worth having — and it needs a process before it needs a
schema, see below.

Two corrections from building them, both in the same direction — a contract stated from a
mockup is wider than the one the code needs:

- **C3 turned out smaller.** Per-node status needs no contract: the interface derives it
  from the topology and the frontiers it has seen. Only the *failure* had to travel.
- **C4 turned out narrower, and unlocked one view rather than two.** No `wired` flag, no
  identifier beside the name, no directory. And the Espace needs C5, not C4: the registry
  names a widget but cannot fill it.

One thing was *added* rather than removed: C2's node gained an optional `skill`. Writing the
Grimoire's status revealed that a node id is not a skill name — `greet` runs `planner` — so
without it every sub-agent state would have been a guess.

---

## C1 — Level transitions · `kern.step-event/v1` · **in use**

**Producer** kern-orch → `POST /api/v1/steps`. Specified in [README.md](../README.md).

Feeds the Agents view and the system beacon today. Its limits are the reason C2, C3 and C10
exist: it reports *the next frontier* of a run, and nothing about the shape of the graph, the
state of an individual node, or a failure.

---

## C2 — Run topology · **in use**

**Producer** kern-orch. The data already exists in `internal/topology` and `graph.Graph`; it
is simply never sent.

**Why** The mockup does not draw runs as cards. It draws a hive: an orchestrator node at the
top, sub-agent nodes below, edges between them, animated on the active paths. A frontier
alone cannot be laid out — kern-ui does not know which nodes exist, nor what connects them.
The card list shipped today is a stand-in for a graph.

**Shipped** The topology rides on the first event of a run. It is read from the declared
YAML, not from the running graph: `graph.Graph`'s edges are `RouteFunc` closures, so a
conditional route cannot be enumerated. Such an edge travels with no targets and
`dynamic: true`, and the interface draws a dashed stub rather than a dead end it cannot
vouch for.

**Updated 2026-07-28: sub-graphs are no longer a single dot.** A subgraph node now reports
its nested graph as a run of its own, carrying `parent` — the run it belongs to and the node
inside it. The interface opens the node and draws that run with the same component, so depth
costs nothing and a sub-agent reads in the language its parent already taught.

Sending only the child's *shape* was the cheaper option and would have been worse than
nothing: a fully grey nested hive under a node marked finished, teaching the reader something
false. A nested run reports its levels like any other, so its nodes carry real state.

---

## C3 — Run failure · **in use**

**Producer** kern-orch.

**Why** The mockup colours each node by state: `actif` cyan, `repos` amber, `bloqué` red.
Today a node is either in the frontier or invisible, and **no run can be reported as failed**
— `kern.step-event/v1` has no error field. That is also why the beacon can never show
`Tension`: nothing can report trouble.

**Shipped, and smaller than expected.** Per-node status needed no contract: the interface
accumulates the frontiers it sees and derives `pending` / `active` / `done` from the
topology. Only the failure had to travel — v1 could not express one at all, so a broken run
was indistinguishable from a finished one.

The failure carries the frontier that was running when it broke, which is what lets the
interface colour the right nodes. **Updated 2026-07-28: it now names the nodes that broke.** The engine waits for a whole
level before giving up, so which nodes failed and which finished was known inside kern-orch
and thrown away into a string — the same shape of loss as the `skill` reference. The failure
carries `nodes`, and a node of the reported frontier absent from that list **completed**,
which is a guarantee rather than an inference. A producer that cannot say omits the field,
and the interface falls back to marking the whole frontier as before.

---

## C4 — Skills & tools registry · `kern.registry/v1` · **in use**

**Producer** kern-orch → `POST /api/v1/registry`, on every `run` and on
`kern-orch publish-skills`. Specified in [README.md](../README.md).

**Why** The Grimoire lists competences and the sub-agents that hold them. kern-orch held the
registry since its own bootstrap and only ever printed it on a terminal.

**Shipped, and narrower than written here.** Three fields per skill: `name`, `kind`
(`tool` / `agent` — kern-orch's own two types, not `skill` / `tool` as stated above),
`description`.

Three things this file asked for and the code refused:

- **No `wired` flag.** In kern-orch a loaded skill is by definition available. The field
  would read `true` on every row — a column that carries no information.
- **No identifier beside the name.** kern-orch indexes its registry by name; inventing a
  second key for the wire would publish something the producer does not have.
- **No directory.** A filesystem path is an internal, not a contract.

**It unlocks one view, not two.** The Espace's widgets show a live measurement, and the
catalogue names a widget without being able to fill it. That is C5, below.

**A note on the two empties.** `GET` answers `404` until someone publishes, and a published
catalogue may be empty. Those are different facts — no producer, versus a producer holding
nothing — and the Grimoire draws a different screen for each.

---

## C5 — Tool invocation and readback · missing

**Producer** kern-tools 🟡. **Now the only thing standing between the Espace and its
widgets** — since C4, the interface knows which tools exist.

**It needed a process before it needed a schema**, and that process was decided on
2026-07-28: **kern-orch becomes a daemon**. A widget value refreshes on a clock, independently
of runs, and until then nothing was alive between two graphs to push or be polled. The
prerequisite is now work rather than a question — the daemon first (kern-orch EPIC-03), this
contract on top.

**Why** An Espace widget is not just a name: it shows a live measurement — *Pull requests
ouvertes 4*, *Messages non lus 12*, *Prochain rendez-vous 14:30*. That value has to be read
from the tool behind the widget.

**Needed** A way to ask a wired tool for a display value: a label and a rendered string, plus
how stale it may be. kern-ui must never format domain data itself.

**Open question** Whether kern-ui reads tools directly or whether kern-orch reads on its
behalf. Reading directly would give kern-ui a second producer to talk to — worth deciding
deliberately rather than by accident.

---

## C6 — Steering channel · missing

**Producer** kern-pilot ⬜ (steer · queue · replan · nudge).

**Confirmed scope on 2026-07-28**, not a hypothesis any more: stopping an agent, approving or
refusing one of its decisions, and triggering a simple action are all wanted. Multi-user was
decided in the same session, so this contract carries **who** is steering from the start —
retrofitting an actor onto a write path is the expensive kind of change.

**Why** Three separate things in the mockup need it, and all three are inert today:

- the conversation bar — the stone's bubble is disabled and says so;
- `Nouveau sous-agent` in the Grimoire;
- `Accepter` / `Ignorer` on the suggestions in Rédaction.

**Needed** Send an instruction to a running graph, and receive what came back. This is the
only contract on this list that is a *write* path — every other one is read-only. It deserves
its own thinking about permissions, which is `kern-policy` ⬜ territory.

---

## C7 — Memory graph · missing

**Producer** kern-memory ⬜ (decided in the roadmap: `.okf` · RAG · DAG, chromem-go, pure Go).

**Why** The Cerveau view is a navigable graph of memories — *Cerveau — 248 souvenirs actifs*,
named nodes (`Idée produit`, `Lancement Q3`, `Recherche client`), *molette pour zoomer,
double-clic pour plonger*.

**Needed** Memory nodes with labels and links, an active count, and a way to fetch a
neighbourhood rather than the whole graph — the mockup's zoom and dive only make sense if the
interface can ask for a sub-graph.

---

## C8 — Documents and suggestions · missing

**Producer** kern-memory ⬜ for documents, kern-pilot ⬜ for the accept/ignore path.

**Why** The Rédaction view holds notes (*Notes — Vision du produit*, *482 mots · sauvegardé à
l'instant*), a `Journal des décisions`, and inline suggestions the user accepts or ignores.

**Needed** Document content and save state, an append-only decision log, and a suggestion
stream whose entries can be resolved. Whether a document lives in kern-memory or somewhere
else is not settled.

---

## C9 — Browser session and approval queue · missing

**Producer** kern-exec ⬜ for driving the browser, kern-pilot ⬜ for approvals.

**Why** The Navigateur view shows an agent operating a page (*Agent au clavier*), a
timestamped log of its actions, and an `En attente de confirmation` queue — the agent asking
permission before acting.

**Needed** A view of the session, the action log, and a queue whose entries can be approved or
refused. **The approval path is the one place in this interface where a wrong click has
consequences outside the screen** — it needs its contract before its pixels.

---

## C10 — Live activity signal · `kern.activity/v1` · **in use**

**Producer** kern-orch → `POST /api/v1/activity`. Specified in [README.md](../README.md).

**Why** The beacon has four states in the mockup and `systemState()` could produce two.

**Shipped, and half of it turned out to need no contract at all.** `Tension` was already
reachable: C3 made a run able to report failure, and the code simply had not caught up — the
comment in `systemState.ts` still said no run could fail. Only `Réflexion` needed something
new.

What travels is deliberately coarse: one node, started or stopped. Token-level detail stays
kern-orch's business.

Two things this contract taught, both about timing rather than shape:

- **It opens runs.** An agent generates before its level completes, so the first activity of
  a run arrives before any step event. It carries `graph` for that reason, and a run at step
  0 is one whose shape has not arrived yet — which the Agents view now says, instead of
  claiming a topology was never declared.
- **It is reported off the run's thread**, so an agent never waits on the interface before it
  may start working. That makes signals able to overtake each other, which is why each
  carries `at` and the projection keeps only the freshest word about a node.

A correction it forced elsewhere: `Bloqué` in the Grimoire, and `Tension` on the beacon, now
only count **while the failure is the last word**. A run that broke an hour ago was keeping a
sub-agent red for ever, which reads as a statement about the present and was not one.

---

## C11 — Skill and sub-agent authoring · **deferred, 2026-07-28**

> **Decided: not in the POC, and its shape moved.** Creating agents is out of the mobile
> surface, reserved to the Kern team at first, and — the part that matters here — is headed
> towards a **no-code node editor** rather than skill authoring: simple blocks a client wires
> together, an ultra-simplified n8n in the spirit of Scratch.
>
> That is not the same contract. Authoring a SKILL.md is writing a file into a registry;
> wiring a graph is producing **the YAML kern-orch already loads**. The format exists, so
> such an editor invents nothing and is a kern-ui feature rather than a brick — which also
> means what it needs from a producer is closer to "store and run this graph" than to
> anything in the section below.
>
> The three questions below stay open and stay relevant, but read them knowing the object
> may be a graph rather than a skill. The Grimoire's `+` stays drawn and disabled.



**Producer** Undecided. Which brick produces this *is* the open question, and it has to be
settled by people before anything is written.

**Why it surfaced** Building C4 made the shape of the registry visible, and with it what the
registry cannot do. Two affordances in the mockup have no producer: `Nouveau sous-agent` in
the Grimoire, and the `+` beside the competences. Both are drawn and disabled today.

### What exists, precisely

A sub-agent is **not a distinct object**. It is a skill whose SKILL.md frontmatter says
`type: agent` rather than `type: tool` — one field, and the Grimoire's two columns are that
field. There is no notion of a *system* skill versus any other: one flat directory
(`KERN_SKILLS_DIR`, default `skills/`), one subdirectory per skill, re-read on every
invocation. It is a directory, not a store: no index, no write path, no versioning.

`skills.Load` only reads. **Nothing in the ecosystem can create a skill or a sub-agent.**
That is why the question "who stores a sub-agent" has no answer today — it only bites for a
sub-agent that is *created*, not one shipped on disk.

Note that `kern-skills` and `kern-tools` are marked in the roadmap as sub-packages of
kern-orch, **extractable into bricks of their own later**. So kern-orch carries the registry
today without owning it by right. The extraction costs nothing on this side: the producer of
`kern.registry/v1` is a configured URL, so it can change brick without kern-ui noticing.

### The three decisions, in the order they constrain each other

1. **One tier or two?** Shipped skills read-only on one side and created ones on the other,
   or everything in the same directory — at the risk of a kern-orch update overwriting
   something a user made. Two tiers means the catalogue gains a field saying which is which,
   and the Grimoire can then refuse to offer deletion of what it did not create.

2. **Who writes?** kern-orch holds the directory; kern-pilot holds the creation path
   (C6); a created sub-agent is arguably a memory, which would be kern-memory. The reading
   that fits what already exists: **kern-pilot commands, kern-orch writes** — whoever reads a
   directory should be the one who writes it, otherwise two bricks contend for the same files
   and neither owns the outcome. This is a recommendation, not a decision.

3. **Multi-user.** The question still open below lands directly here: a sub-agent created by
   whom, visible to whom, deletable by whom. Answering (1) and (2) without it risks writing a
   store that has no owner field and needs one three months later.

### What the interface would need, once decided

Only two things, and neither is large: a way to submit a new skill or sub-agent and learn
whether it was accepted, and a marker on each catalogue entry saying whether this interface
may edit it. **The write path deserves its contract before its pixels** — same rule as the
approval queue in C9.

---

## C12 — Messaging channel · **scope confirmed, contract to write**

**Producer** `kern-pilot` ⬜ for the commands, plus whichever platform the client already
uses — Telegram, Slack or WhatsApp.

**Why** Decided on 2026-07-28: the phone must react, and rather than building push
notifications kern-ui borrows a messaging app the client already has. It removes native push,
store presence and encrypted transport from our plate in one move, and meets a user who has
never heard of Slack but has WhatsApp on their phone.

**It is not only an output.** The intent is that a run can be *piloted* from the chat —
stopped, approved, refused, nudged. That makes it a second surface over the same contract as
the conversation bar, which is C6. One steering contract, two surfaces.

**What it needs, beyond C6.** Two things that have no equivalent in the interface:

- **A binding between a messaging account and a Kern account.** Without it, whoever can
  message the bot can steer an agent. This is authentication living outside our own surface,
  and it carries the same weight as C9's approval queue.
- **Outbound delivery that survives the platforms' differences.** A Telegram bot is a token.
  A Slack app is installed per workspace. WhatsApp needs a verified Meta business account and
  pre-approved templates for any message we initiate, billed per conversation. The contract
  should name *what* is being said and let an adapter decide how — otherwise WhatsApp's
  constraints leak into every caller.

**Not settled, and worth settling before shipping rather than before prototyping.** Whether
a critical approval may be given by chat at all, or only in the interface. And where the data
goes: routing a company's work through Meta's or Telegram's servers is a data-processing
question, most likely a GDPR one before an AI Act one. Neither is something this repo can
answer on its own.

---

## What the interface will not ask for

- **Anything it can derive.** Run status, ordering and counts are computed from C1.
- **Presentation.** Colours, glyphs and labels belong to kern-ui. A brick sending a hex
  colour or an icon name is a brick doing the interface's job.
- **Another brick's internals.** kern-ui reads no database file and no checkpoint schema. If
  a piece of data is not in a published contract, it does not exist as far as kern-ui is
  concerned.
