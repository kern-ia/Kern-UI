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
| C4 | Skills & tools registry | kern-skills ✅ / kern-tools 🟡 | Grimoire **and** Espace | missing |
| C5 | Tool invocation and readback | kern-tools 🟡 | Espace widget values | missing |
| C6 | Steering channel | kern-pilot ⬜ | Conversation, sub-agent creation, accept/ignore | missing |
| C7 | Memory graph | kern-memory ⬜ | Cerveau | missing |
| C8 | Documents and suggestions | kern-memory ⬜ + kern-pilot ⬜ | Rédaction | missing |
| C9 | Browser session and approval queue | kern-exec ⬜ + kern-pilot ⬜ | Navigateur | missing |
| C10 | Live activity signal | kern-obs ⬜ or kern-link 🔌 | `Réflexion` beacon | missing |

**C2 and C3 shipped on 2026-07-26** as `kern.step-event/v2`: the Agents view now draws the
hive the mockup shows. **C4** is the next one worth having — it unlocks two views at once.

One correction from building them: C3 turned out smaller than written here. Per-node status
needs no contract at all — the interface derives it from the topology and the frontiers it
has already seen. Only the *failure* had to travel, because nothing in v1 could express one.

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

## C4 — Skills & tools registry · missing

**Producer** kern-orch, through `kern-skills` (✅, sub-package, extractable) and `kern-tools`
(🟡). Exposed today on the CLI only, as `kern-orch list-skills`.

**Why two views at once** The Grimoire lists competences (`Analyse`, `Synthèse`, `Recherche`,
`Mémoire`, `Vision`, `Écriture`, `Orchestration`, `Vigilance`) and the sub-agents that hold
them. The Espace shows widgets over MCP servers — and MCP servers are tools or skills the
agent wires on demand, not a brick of their own. Same registry, one contract.

**Needed** The catalogue: id, name, kind (`skill` / `tool`), description, and whether it is
currently wired. Glyphs are decoration and belong to kern-ui, not to the contract.

**Not needed** How a skill is implemented, or its SKILL.md body.

---

## C5 — Tool invocation and readback · missing

**Producer** kern-tools 🟡.

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

## What the interface will not ask for

- **Anything it can derive.** Run status, ordering and counts are computed from C1.
- **Presentation.** Colours, glyphs and labels belong to kern-ui. A brick sending a hex
  colour or an icon name is a brick doing the interface's job.
- **Another brick's internals.** kern-ui reads no database file and no checkpoint schema. If
  a piece of data is not in a published contract, it does not exist as far as kern-ui is
  concerned.
