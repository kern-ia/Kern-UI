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
| `GET` | `/healthz` | Liveness. |

A producer should target `POST /api/v1/steps`: the run id travels in the body, so the
producer needs one configured URL and stays unaware of our route shape.

#### `StepEvent` — contract `kern.step-event/v1`

<!-- CANONICAL BLOCK — mirrored verbatim in Kern-UI/README.md and Kern-Orch/README.md.
     Drift is caught by tests, not by discipline: the same payload lives in
     contracts/kern.step-event.v1.json in both repos, and each side asserts against it
     on every CI run — kern-orch that its reporter emits exactly this, kern-ui that its
     ingestion accepts exactly this. Change the contract and both suites go red. -->

```json
{
  "run_id": "a23ead5373d9b746",
  "graph": "hello",
  "step": 2,
  "frontier": ["synthese", "critique"],
  "state": { "echo": "..." },
  "at": "2026-07-26T12:00:02Z"
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

On `POST /api/v1/steps` the `run_id` must be in the body. On
`POST /api/v1/runs/{id}/steps` it may be omitted, and a body value contradicting the path
is rejected.

**Semantics a producer can rely on**

- **Idempotent.** Replaying a step, or sending one older than the current level, is accepted
  and changes nothing. A reporter may retry without coordination.
- **An empty `frontier` closes the run.** Later events for that run are ignored.
- **`202 Accepted`** on success, **`400`** on a payload violating the schema. A `400` is a
  producer bug, not a transient failure — retrying will not help.
- **Reporting is never load-bearing.** A producer must treat this endpoint as best-effort
  and must not fail a run because kern-ui is slow, broken or absent.

#### `GET /api/v1/stream` — SSE

```
event: snapshot
data: [ {run}, {run}, … ]     ← every known run, sent once on connect

event: run
data: { run }                 ← one run changed
```

A `run` carries the `StepEvent` fields plus `status` (`running` | `finished`),
`started_at`, `updated_at` and `ended_at`.

The snapshot-then-updates order is load-bearing: delivery is best-effort and a client that
falls behind has its updates dropped rather than blocking the server. Reconnecting yields a
fresh snapshot, so a gap is transient rather than permanent drift. **A consumer must
resynchronise from the snapshot and must not treat the stream as an event log.**

### Consumed

| Brick | Contract | Status |
|---|---|---|
| `kern-orch` | Pushes `kern.step-event/v1` to `POST /api/v1/steps`. See `../Kern-Orch/README.md`. | in use |
| `kern-pilot` | Steering channel (steer · queue · replan · nudge). | not defined yet |
| `kern-obs` | Observability signals and process analysis. | not defined yet |
| `kern-memory` | Agnostic memory (`.okf` · RAG · DAG). | not defined yet |

`kern-ui` does not own run state or memory: `kern-orch` checkpoints, `kern-memory`
remembers. Its local storage holds only what belongs to it — widget layout, preferences,
display cache. **Losing kern-ui's data must cost nothing but a reload.**

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
