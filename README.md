# kern-ui

**The interface brick of the Kern ecosystem: it shows what the agents are actually doing.**

Agent work happens in a terminal — invisible, impossible to steer, impossible to pick back
up. `kern-ui` is a single Go binary that receives run transitions from the other bricks and
streams them to a browser, on a desktop or a phone.

It is a `kern-*` brick like the others: autonomous, agnostic, and reachable only through the
contracts below. It never reaches into another brick's internals.

```sh
make build                                        # binary + SPA
KERN_UI_WEB_DIR=internal/httpapi/dist ./bin/kern-ui
open http://127.0.0.1:7777
```

Feed it from kern-orch:

```sh
cd ../Kern-Orch
KERN_STEP_REPORT_URL=http://127.0.0.1:7777/api/v1/steps go run . run examples/hello.yaml
```

---

## Connection contracts

Every `kern-*` brick publishes what it accepts and states what it needs. Nothing else is
part of the contract: internal schemas, database files and package layouts may change
without notice.

### Exposed — HTTP API

Base URL defaults to `http://127.0.0.1:7777` (`KERN_UI_ADDR`).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/steps` | Ingest one completed graph level. **Use this one.** |
| `POST` | `/api/v1/runs/{id}/steps` | Same, run id in the path. Convenience for humans and tests. |
| `GET` | `/api/v1/runs` | Snapshot of every known run. |
| `GET` | `/api/v1/runs/{id}` | One run. |
| `GET` | `/api/v1/stream` | Server-Sent Events: snapshot, then live updates. |
| `POST` | `/api/v1/activity` | One node started or stopped generating. |
| `POST` | `/api/v1/registry` | Publish the whole skills catalogue. |
| `GET` | `/api/v1/registry` | The catalogue, or `404` while none has been published. |
| `GET` | `/healthz` | Liveness. |

A producer should target `POST /api/v1/steps`: the run id travels in the body, so the
producer needs one configured URL and stays unaware of our route shape.

### Authentication

Two credentials, because there are two kinds of caller wanting opposite things.

| Caller | Presents | May |
|---|---|---|
| A producer (kern-orch) | `Authorization: Bearer <KERN_UI_TOKEN>` | **post** events only |
| A person (browser) | a session cookie, from `POST /api/v1/login` | **read** only |

Neither opens the other's doors: a producer token cannot enumerate runs, and a session
cannot inject events. Collapsing them into one credential would mean the secret configured
on every machine also reads everything.

`GET /healthz`, the login endpoints and the SPA itself stay open — a probe carries no
credential, and the login page has to be reachable before anyone has a session.

**With nothing configured, everything is open.** That is the local development case, and it
is safe only because the binary **refuses to start** on a public address without both
`KERN_UI_TOKEN` and at least one account. An empty host counts as public: `:7777` looks
innocent and binds every interface.

Accounts live in `KERN_UI_ACCOUNTS` (default `./data/accounts`), one `name:hash` per line,
written by `kern-ui useradd <name>` — the password is read from standard input, never given
as an argument where the shell history and the process list would keep it. Hashes are
PBKDF2-HMAC-SHA256 at 600 000 iterations, from the standard library: argon2id resists
purpose-built cracking hardware better, and costs this binary its only dependency-free
property. Revisit that trade the day a hash database could leak.

### TLS

A public address is served encrypted or not at all. Authenticating over plain http protects
against a bystander and not against a network, which is the more dangerous of the two
illusions — so this is a refusal to start, not a warning.

| Deployment | Set |
|---|---|
| kern-ui serves TLS | `KERN_UI_TLS_CERT` and `KERN_UI_TLS_KEY` (TLS 1.2 floor) |
| A reverse proxy terminates it | `KERN_UI_TRUST_PROXY=1` |
| Local development | nothing — loopback is exempt |

`X-Forwarded-Proto` decides whether the session cookie is marked `Secure` and whether HSTS
is sent, but **only when a proxy is declared**. Any client can set that header; believing it
by default would let a caller declare their own connection safe.

#### `StepEvent` — contract `kern.step-event/v2`

<!-- CANONICAL BLOCK — mirrored verbatim in Kern-UI/README.md and Kern-Orch/README.md.
     Drift is caught by tests, not by discipline: the same payloads live in
     contracts/kern.step-event.v2*.json in both repos, and each side asserts against them on
     every CI run — kern-orch that its reporter emits exactly this, kern-ui that its
     ingestion accepts exactly this. Change the contract and both suites go red. -->

```json
{
  "run_id": "a23ead5373d9b746",
  "graph": "hello",
  "step": 2,
  "frontier": ["synthese", "critique"],
  "state": { "echo": "..." },
  "at": "2026-07-26T12:00:02Z",
  "requester": "yoann",
  "dossier": "AF-2288",
  "topology": {
    "entry": "greet",
    "nodes": [{ "id": "greet", "kind": "agent", "skill": "planner" }],
    "edges": [{ "from": "greet", "to": ["synthese"] }]
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `run_id` | string | yes | Identifies the run. |
| `graph` | string | yes | Human label for the run, shown by the consumer. |
| `step` | int >= 0 | yes | Level counter, increases within a run. |
| `frontier` | string[] | yes | The nodes to execute **next**. An empty list means the run is over. |
| `state` | object | no | Flat business data. Never a producer's internal envelope. |
| `at` | RFC 3339 | yes | When the level completed. |
| `requester` | string | no | Who asked for this run (C6). Empty means open — steerable by anyone. Sent **once**, on the run's first event, like `topology`. |
| `dossier` | string | no | A caller-supplied business label (e.g. a client case) grouping several runs together for a consumer like the dossiers list. Distinct from `requester` — an identity used for a steering-permission check, not a grouping key. Empty means the run belongs to no dossier. Sent **once**, on the run's first event. |
| `topology` | object | no | The graph's shape. Sent **once**, on the run's first event. |
| `topology.entry` | string | yes | Entry node id. Never appears in a frontier — it ran first. |
| `topology.nodes[]` | object | yes | `id` and `kind` (`tool` / `agent` / `subgraph`), plus `skill` on an agent node. |
| `topology.nodes[].skill` | string | no | The catalogue entry backing the node. **Not the id** — a node `greet` may run the skill `planner`, so matching the two by name would be a guess. Absent on tool nodes, which name a Go function. |
| `topology.edges[]` | object | no | `from`, `to[]`, or `dynamic: true` when a router picks the targets at run time. |
| `error` | object | no | Set on the terminal event of a run that failed; `message` is required. |
| `parent` | object | no | Set on a **nested run** — the graph a subgraph node ran. `run_id` is the parent run, `node_id` the node it belongs to. Absent on a top-level run. |
| `error.nodes[]` | string[] | no | The nodes of `frontier` that actually broke. A node in `frontier` and **absent here completed** — the producer waits for the whole level before giving up. Omitted when the producer cannot say, and a consumer then falls back to marking the whole frontier. |

On `POST /api/v1/steps` the `run_id` must be in the body. On
`POST /api/v1/runs/{id}/steps` it may be omitted, and a body value contradicting the path
is rejected.

**Semantics a producer can rely on**

- **Idempotent.** Replaying a step, or sending one older than the current level, is accepted
  and changes nothing. A reporter may retry without coordination.
- **An empty `frontier` closes the run.** Later events for that run are ignored.
- **A nested run is a run of its own.** A subgraph node reports its child under a fresh
  `run_id` carrying `parent`, never folded into the parent's stream: the parent's level
  counter is a sequence, and two graphs advancing against it at once would corrupt it. The
  reference composes at any depth, where nesting topologies inside topologies would need a
  recursive schema. The same node running twice is two nested runs, and the interface draws
  the freshest.
- **`202 Accepted`** on success, **`400`** on a payload violating the schema. A `400` is a
  producer bug, not a transient failure — retrying will not help.
- **Reporting is never load-bearing.** A producer must treat this endpoint as best-effort
  and must not fail a run because kern-ui is slow, broken or absent — including not running
  slower for it. kern-orch queues levels and delivers them from a single worker, in order.

#### `ActivityEvent` — contract `kern.activity/v1`

<!-- CANONICAL BLOCK — mirrored verbatim in Kern-UI/README.md and Kern-Orch/README.md.
     The same payload lives in contracts/kern.activity.v1.json in both repos, asserted from
     both sides on every CI run. -->

```json
{
  "run_id": "a23ead5373d9b746",
  "graph": "hello",
  "node_id": "greet",
  "generating": true,
  "at": "2026-07-26T12:00:01Z"
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `run_id` | string | yes | Identifies the run. |
| `graph` | string | yes | Human label. Required because this event routinely **opens** a run — see below. |
| `node_id` | string | yes | The node whose model started or stopped. |
| `generating` | bool | yes | `true` when the model began working, `false` when it finished. |
| `at` | RFC 3339 | yes | When the transition happened. |
| `message` | string | no | Plain-language narration of what the node just did, on a stop signal only — set when the node's own output carries `state["display:<node_id>"]`. Absent (never an empty string) whenever a node opts out. |

It is a sibling of `kern.step-event`, never a field of it: a step describes a level that has
*completed*, while generation happens inside a level. Anything carried on a step event would
arrive long after the fact it describes stopped being true.

**Semantics a producer can rely on**

- **It may open a run.** An agent generates before its level completes, so the first activity
  of a run always arrives before any step event. kern-ui creates the run as `running`, with
  an empty frontier meaning *not reported yet* rather than *over*. That is why `graph`
  travels here.
- **Out-of-order signals are safe.** A producer should report off the run's thread — an agent
  must not wait on this endpoint before it may start working — so two signals may overtake
  each other. Only the freshest word about a given node counts; an older one is accepted and
  changes nothing.
- **A terminal run generates nothing.** Signals arriving after a run ended are accepted and
  ignored, and finishing a run clears whatever it had generating.
- **`202 Accepted`** on success, **`400`** on a payload violating the schema.
- The result rides the existing run stream: `generating` is a field of a run, so a browser
  already subscribed receives it with no second connection.
- **`message` is opt-in, never invented.** It reuses a node's existing
  `state["display:<node_id>"]` output — the same value the hive panel already shows for
  that node — rather than a second, separate way for a skill to narrate itself. A node that
  sets no display key reports no message. kern-ui accumulates messages received (bounded,
  oldest dropped first) into `Run.activity_log`, distinct from `generating`'s
  latest-word-wins semantics — a log is meant to be read back, not just overwritten.

#### `Catalogue` — contract `kern.registry/v1`

<!-- CANONICAL BLOCK — mirrored verbatim in Kern-UI/README.md and Kern-Orch/README.md.
     Drift is caught by tests, not by discipline: the same payload lives in
     contracts/kern.registry.v1.json in both repos, and each side asserts against it on
     every CI run — kern-orch that its publisher emits exactly this, kern-ui that its
     ingestion accepts exactly this. Change the contract and both suites go red. -->

```json
{
  "source": "kern-orch",
  "at": "2026-07-27T12:00:00Z",
  "skills": [
    { "name": "Analyse", "kind": "tool", "description": "Décompose une demande." },
    { "name": "Scribe", "kind": "agent", "description": "Rédige et reformule." }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `source` | string | yes | Which brick published this catalogue. |
| `at` | RFC 3339 | yes | When it was read. |
| `skills[]` | array | yes | Every skill the producer holds. May be empty — see below. |
| `skills[].name` | string | yes | The key. Unique within a catalogue. |
| `skills[].kind` | string | yes | `tool` (executed directly) or `agent` (backed by a model). |
| `skills[].description` | string | no | One line, shown as-is. |
| `skills[].custom` | bool | no | `true` for a skill created through C11's write path; absent for every shipped one. |
| `skills[].created_by` | string | no | The account that created a custom skill; absent for a shipped one. kern-ui compares this against the signed-in account to decide whether to show a delete control — never the sole check, the same request is re-verified server-side by kern-orch on delete. |

**Semantics a producer can rely on**

- **Published whole, never patched.** Each publication replaces the previous one, so a
  skill deleted upstream disappears downstream. There is no delete message and none is
  needed.
- **Idempotent.** Republishing the same catalogue changes nothing, so a producer may
  publish on every run without coordination.
- **An empty `skills` list is a statement**, not a non-answer: it says the producer holds no
  skill. `GET` answers `404` until someone has published, which is a different fact and
  draws a different screen.
- **`202 Accepted`** on success, **`400`** on a payload violating the schema. A rejected
  publication leaves the previous catalogue standing — a producer pushing garbage must not
  be able to blank the view.
- **Reporting is never load-bearing.** A producer must treat this endpoint as best-effort
  and must not fail a run because kern-ui is slow, broken or absent.

**What deliberately does not travel.** The directory a skill lives in — a filesystem path is
an internal, not a contract. Any "wired" flag — in kern-orch a loaded skill is by definition
available, so the field would read true on every row. Glyphs, colours and labels — those are
the interface's job, and a brick sending an icon name is a brick doing it. `custom`/
`created_by` are the one exception: kern-ui genuinely cannot decide whether to offer
deleting a skill without them.

#### `GET /api/v1/stream` — SSE

```
event: snapshot
data: [ {run}, {run}, … ]     ← every known run, sent once on connect

event: run
data: { run }                 ← one run changed
```

A `run` carries the `StepEvent` fields plus `status` (`running` | `finished` | `failed`),
`started_at`, `updated_at`, `ended_at`, and `generating` — the nodes whose model is working
right now, fed by `kern.activity/v1`.

The snapshot-then-updates order is load-bearing: delivery is best-effort and a client that
falls behind has its updates dropped rather than blocking the server. Reconnecting yields a
fresh snapshot, so a gap is transient rather than permanent drift. **A consumer must
resynchronise from the snapshot and must not treat the stream as an event log.**

### Consumed

Three contracts exist. Five more are needed for the interface to stop saying "this view waits
for a brick" — each one is stated, with its producer and what it unlocks, in
[docs/expected-contracts.md](docs/expected-contracts.md).

| Brick | Contract | Status |
|---|---|---|
| `kern-orch` | Pushes `kern.step-event/v2` to `POST /api/v1/steps`. See `../Kern-Orch/README.md`. | in use |
| `kern-orch` | Pushes `kern.registry/v1` to `POST /api/v1/registry`. | in use |
| `kern-orch` | Pushes `kern.activity/v1` to `POST /api/v1/activity`. | in use |
| `kern-orch` | Tool invocation and readback (Espace widget values) | needed |
| `kern-pilot` | Steering channel (steer · queue · replan · nudge) | needed |
| `kern-memory` | Memory graph · documents | needed |
| `kern-exec` | Browser session and approval queue | needed |

`kern-ui` does not own run state or memory: `kern-orch` checkpoints, `kern-memory`
remembers. Its local storage holds only what belongs to it — widget layout, preferences,
display cache. **Losing kern-ui's data must cost nothing but a reload.**

---

## Theming — one codebase, several client brands

`kern-ui` is meant to sit in front of more than one client, each with its own visual
identity — the internal "Grimoire Ambré" look (dark ground, gold accent, Cinzel + Space
Grotesk) is Kern's own, not every client's. The first real case is
[Avel Finances](https://avelfinances.fr): its client and advisor mockups
(`design/mockups/avel-client.dc.html`, `design/mockups/avel-admin.dc.html`) use a
completely different navy/blue identity and vocabulary, deliberately — the mockup art
direction stays authoritative *per brand*, not as one fixed palette for every deployment.

**The mechanism is a per-brand build, not a runtime switch.** Concretely:

- **Colours, fonts, spacing** — already centralised in
  [`web/src/styles/tokens.css`](web/src/styles/tokens.css): one `:root` block of custom
  properties, consumed via `var(--token)` almost everywhere (verified: only 6 stray
  hard-coded hex values exist across the whole frontend, in
  `ConversationStone.module.css` and `RedactionView.module.css` — everything else,
  including JS-side state-colour maps, already goes through a token). A second brand
  means a second token set — either a sibling `:root[data-theme="avel"]` block or a
  separate `tokens.css` swapped at build time — plus fixing those 6 stray lines so
  nothing hides outside the token layer. This part is cheap: a palette swap, not a
  redesign.
- **Copy and vocabulary** — `web/src/i18n/fr.ts` is a single flat object imported
  directly (`import { fr } from '../i18n/fr'`) in 24 files. It is **not** swappable
  today: a second brand's copy (Kern's internal "agent", "run", "node" vocabulary vs.
  Avel's client-facing "dossier", "conseiller", "agent") needs either a full duplicate
  object kept in sync by hand, or refactoring those 24 imports behind an indirection
  (a `useCopy()`-style lookup). Real work, not a side effect of the token swap above —
  scope it as its own piece before promising a second brand's wording, not after.
- **Bespoke components** — `ConversationStone` (the "stone" chat control: gold glow,
  Cinzel numerals, a specific gradient texture) is Kern's own visual metaphor, not a
  generic shape with swappable colours. A brand whose mockup uses a structurally
  different control (Avel's admin mockup replaces it with a plain command bar) needs its
  own component variant, not a retheme of this one — check the target brand's mockup
  before assuming the existing component just needs new tokens.
- **Serving it** — the Go backend needs **no changes** for this: `KERN_UI_WEB_DIR`
  (`cmd/kern-ui/main.go`) already points at one static bundle per running instance. One
  `npm run build` per brand (each with its own token set baked in) produces one `dist/`
  per brand; each gets its own `kern-ui` deployment (own `KERN_UI_ADDR`, own
  `KERN_UI_ACCOUNTS`, pointed at its own `KERN_UI_WEB_DIR`). This is the same "one binary,
  one config, one data dir per deployment" shape `kern-launcher` already uses for
  `kern-memory`/`kern-orch`/`kern-ui` — a themed brand is just another instance of that
  same pattern, not a new one.

**What this deliberately does not attempt**: one binary serving several brands at once,
chosen per account or per domain at request time. Nothing today carries a "which brand"
concept anywhere — not in `internal/httpapi`'s config, not in the accounts file, not in
the frontend. Building that would mean a real selection mechanism end-to-end (backend
config → account model → frontend context) instead of "build twice, deploy twice." Worth
it once there are enough brands that separate builds/deployments become the actual
bottleneck — not assumed necessary before that's true.

---

## Development

```sh
make test     # Go (race) + front
make lint
make dev      # Go server; run `npm run dev` in web/ alongside it
make dist     # cross-compile every target
```

Conventions, method and house rules live in [CLAUDE.md](CLAUDE.md). Per-feature context is
in [docs/index/](docs/index/) — read those instead of re-reading the code.

## License

MIT — see [LICENSE](LICENSE).
