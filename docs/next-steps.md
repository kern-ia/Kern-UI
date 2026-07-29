# Where kern-ui stands, and what comes next

Written 2026-07-26, updated 2026-07-27 when the skills registry shipped. Read this plus
[`docs/index/`](index/) to pick the work back up without re-reading the code.

---

## Où j'en suis

> Bloc court, tenu à jour **à chaque feature fusionnée** — pas seulement en fin de session.
> Il existe pour qu'une reprise n'ait pas à relire le code. Le reste du fichier donne le
> pourquoi ; celui-ci donne la position.

**Dernier livré** — 2026-07-29 : quatre features fusionnées dans `dev` (kern-notify + deux
repos kern-orch/kern-ui) dans la même journée :
1. **C12 livré** — nouveau dépôt `kern-notify` (relais SSE kern-ui → Telegram, notifications
   seules, vérifié contre un vrai bot Telegram).
2. **EPIC-03 clos côté kern-orch** — un skill `type: tool` déclare `command`/`params` en
   frontmatter, exécuté en subprocess, exposé par `kern-orch serve`
   (`GET /api/v1/tools`, `POST /api/v1/tools/{name}/invoke`).
3. **C5 clos côté kern-ui** — l'Espace lit ce catalogue à la demande (pull, pas push comme
   les autres contrats) et affiche une carte par outil sans paramètre requis. **Vérifié dans
   un vrai navigateur** : compte créé, connexion au clavier, la carte `heartbeat` affiche une
   vraie heure venue d'un vrai subprocess Python.
4. **Sujet consigné, pas tranché** : MCP stateless (spec 2026-07-28) noté dans
   `a-trancher.md` — pas un besoin aujourd'hui, mais l'endpoint tools de kern-orch est déjà
   dans cet esprit si le besoin apparaît un jour.

`dev` à jour dans les deux dépôts, `main` toujours pas repositionné depuis le jalon
2026-07-28. Avant ça : backend Linux réel pour `kern-exec` (`landlock` + espace de noms
réseau), vérifié dans une vraie VM ; avant ça, le câblage `kern-exec` ↔ kern-orch sur macOS.

**Asymétrie Linux à connaître** : `landlock` ne couvre que les fichiers (son propre contrôle
réseau, ABI4+, ne restreint que TCP par port — UDP passerait). Le réseau se coupe par un
espace de noms réseau vide à la place. Sans droits root, le créer exige un espace de noms
utilisateur, qu'Ubuntu 24.04+ bloque par défaut — sur une telle machine sans root,
**kern-exec refuse purement et simplement** de lancer une commande avec réseau interdit
plutôt que de replier sur une garantie plus faible en silence. Vérifié dans les deux sens
(root et non-root) sur la même VM.

**La VM colima est arrêtée** après usage (elle consommait 8 Go de RAM alloués) ; `colima
start` la relance en une commande si un futur travail sur le backend Linux en a besoin.

**En cours** — rien. Le prochain point de la liste ci-dessous.

**Ce que kern-exec débloque, et ce qu'il NE fait PAS**
- Débloque : un agent kern-orch peut être confiné (dossiers, réseau, délai) — le trou le
  plus ancien de la liste est enfin fermé, sur macOS.
- Câblage prouvé le 2026-07-29, en A/B sur un vrai run kern-orch : un faux agent qui
  lit un fichier hors périmètre y arrive en direct, échoue derrière kern-exec, le run se
  termine proprement dans les deux cas, signal d'activité intact. **Correction au passage** :
  `KERN_AGENT_CLI` ne porte qu'un chemin sans arguments — le câblage direct annoncé la
  veille était inexact. La bonne forme est un script wrapper (`kern-exec/examples/wrap-agent-cli.sh`),
  toujours sans changement de code kern-orch. Reste à décider quels dossiers autoriser pour
  un agent donné en production — un choix produit, pas technique.
- NE fait PAS : budgets, escalade, politique fine — ça reste `kern-policy`, non construit.
- NE fonctionne PAS sur Linux ni Windows — refus explicite, pas une fausse protection.

**Ce que le mode démon a débloqué** — une instance centralisée est possible (un process qui
reste vivant), et c'était le prérequis de C5, livré depuis (voir ci-dessus).

**Ensuite, dans l'ordre**
1. ~~`kern-exec` — le bac à sable.~~ Fait, macOS + Linux, refus explicite sur Windows.
2. ~~`kern-orch` en démon~~ Fait, 2026-07-28.
3. ~~`C12` — la messagerie~~ Fait, 2026-07-29 (`kern-notify`, notifications seules).
4. ~~C5 — les valeurs de l'Espace~~ Fait, 2026-07-29 (EPIC-03 + Espace kern-ui).
5. **`C6` — le pilotage : arrêter, valider, refuser.** Prochain gros morceau. C'est là
   qu'arrive « qui a demandé cette mission », pas avant. Discuté le 2026-07-29 : le sens
   sortant d'agent-vers-humain existe déjà (`notify` builtin tool, C12) ; le sens entrant
   (Telegram → agent, tâches et documents) est explicitement le périmètre de C6, à cadrer
   avant d'être construit — pas encore fait.

**Petites choses notées, non bloquantes**
- Les identifiants d'étapes s'affichent bruts (`prep`, `nested`). Corriger en amont dans les
  graphes, ou ajouter un libellé optionnel au contrat.
- Le rendu mobile est vérifié depuis le 2026-07-28, par une page qui charge l'application
  dans un cadre à largeur de téléphone (`resize_window` ne fonctionne toujours pas). Reste à
  confirmer sur un **vrai** appareil : le tactile et les barres du système ne se simulent pas.

---

## State

**kern-ui** — `dev`, 14 features merged, 117 front tests + 4 Go packages green, `main` still
at the baseline commit.

**kern-orch** — `dev`, 8 packages green, `main` behind `dev`.

**Milestone posted 2026-07-28**: `dev` merged to `main` in both repos, tagged **v0.1.0** here
and **v0.4.0** in kern-orch. Deliberately before the three chantiers ahead — sandbox,
authentication, daemon — rather than after, since they move a great deal at once.

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
- The three still-unfed views (Cerveau, Navigateur, Rédaction) name the capability they wait
  for. They render no data on purpose, and a test enforces that. The Espace is live since
  2026-07-29: one card per tool with no required param, read from kern-orch on demand.
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

### 2. Authentication · **done, 2026-07-28**

Two credentials, because there are two kinds of caller wanting opposite things. A producer
presents a bearer token and may only post; a person opens a cookie session and may only read.
Neither opens the other's doors — collapsing them would mean the token configured on every
machine also reads everything.

The binary **refuses to listen** on a public address without a token and at least one
account. A warning scrolls past; a process that will not start does not.

**TLS shipped the same day.** A public address is served encrypted or not at all: kern-ui
terminates it, or a declared reverse proxy does. The refusal replaced the warning, on the
same reasoning that produced the refusal about credentials.

Not built, deliberately: **who asked for a mission**. No mission is started from the
interface yet, so the field could only be empty or false. It arrives with steering.

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

**Should `dev` merge to `main`?** Answered by doing it, 2026-07-28. Everything above is
behind `v0.1.0` / `v0.4.0`.

---

## Known gaps, deliberately left

- **No persistence.** Restarting kern-ui empties the projection. Assumed: kern-orch stays
  authoritative. The day finished-run history matters, ask kern-orch for it — do not copy it
  here.
- **Mobile verified at 2026-07-28**, through a page that loads the app inside a
  phone-width frame — `resize_window` still does nothing. Four defects found and fixed. What
  a frame cannot show: touch targets, the system bars, and how a real device scrolls.
- **The Grimoire has no avatars.** The mockup shows a generative avatar per sub-agent;
  nothing generates one, so the skill's rune stands in. A placeholder image would be
  decoration pretending to be data.
- **Creating a skill or a sub-agent is inert.** The mockup's `+` is drawn, disabled, and
  says it waits for kern-pilot — same treatment as the conversation bar.
