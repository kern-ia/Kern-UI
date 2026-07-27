# Contracts kern-ui expects

What the interface needs in order to stop showing "this view waits for a brick", where each
piece of data must come from, and what exists today.

Derived from `design/mockups/*.dc.html` (the six views and their transverse elements) and
from the brick map in `../Kern-Orch/docs/ROADMAP.md`. Statuses use the roadmap's own legend:
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
| C10 | Live activity signal | kern-obs ⬜ or kern-link 🔌 | `Réflexion` beacon | missing |
| C11 | Skill & sub-agent authoring | **undecided — that is the question** | `Nouveau sous-agent`, `+` compétence | **decision first** |

**C11 was added on 2026-07-27**, from building C4: it is the first entry on this list that
is a decision before it is a schema, and it is stated so nobody has to rediscover it.

**C2 and C3 shipped on 2026-07-26** as `kern.step-event/v2`: the Agents view draws the hive
the mockup shows. **C4 shipped on 2026-07-27** as `kern.registry/v1`: the Grimoire is live.
**C5** is the next one worth having — it is all that stands between the Espace and its
widgets.

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

Sub-graphs still appear as a single `subgraph` node. Nesting a sub-graph's own hive inside
the parent's would need the child's topology too, which nothing sends yet.

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
interface colour the right nodes. It does **not** name the node that caused it: the message
is a string. Marking a specific node from it would be a guess dressed as a fact, so the
interface marks the whole frontier that was live.

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

## C10 — Live activity signal · missing

**Producer** kern-obs ⬜ (in progress) or the token stream already flowing through kern-link 🔌.

**Why** The mockup's beacon has four states. `systemState()` in kern-ui can only ever return
two — `Repos` and `Action` — because nothing reports that an agent is *thinking*, and nothing
reports trouble (see C3). The other two colours stay in the palette, never produced.

**Needed** Something coarse: whether a model is currently generating. Token-level detail is
kern-obs's business, not the interface's.

---

## C11 — Skill and sub-agent authoring · **decision first, contract second**

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

## What the interface will not ask for

- **Anything it can derive.** Run status, ordering and counts are computed from C1.
- **Presentation.** Colours, glyphs and labels belong to kern-ui. A brick sending a hex
  colour or an icon name is a brick doing the interface's job.
- **Another brick's internals.** kern-ui reads no database file and no checkpoint schema. If
  a piece of data is not in a published contract, it does not exist as far as kern-ui is
  concerned.
