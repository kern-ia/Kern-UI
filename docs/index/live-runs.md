---
id: okf-002
feature: live-runs
branch: feature/live-runs
status: done
files:
  - internal/projection/projection.go
  - internal/stream/hub.go
  - internal/httpapi/router.go
  - internal/httpapi/runs.go
  - internal/httpapi/stream.go
tests:
  - internal/projection/projection_test.go
  - internal/stream/hub_test.go
  - internal/httpapi/runs_test.go
decisions:
  - "2026-07-26 : frontière vide = run terminé (kern-orch publie la frontière *suivante*, cf. graph.StepInfo)"
  - "2026-07-26 : ingestion idempotente — step ≤ courant ou run terminé sont acceptés sans effet, un reporter peut retenter sans coordination"
  - "2026-07-26 : hub best-effort, il drop plutôt que de bloquer ; le snapshot à la connexion rend le drop survivable, un compteur Dropped() le rend observable"
  - "2026-07-26 : abonnement AVANT lecture du snapshot, sinon les changements entre les deux sont perdus silencieusement"
  - "2026-07-26 : pas de SQLite — la projection est un cache jetable, kern-orch reste autoritatif ; persister dupliquerait un état qu'on a décidé de ne pas posséder"
---

**Quoi** : la chaîne Go de la vue temps réel. `POST /api/v1/runs/{id}/steps` ingère une
transition kern-orch, la projection la replie en état de run, le hub la diffuse aux
navigateurs via `GET /api/v1/stream` (SSE : snapshot puis mises à jour). `GET /api/v1/runs`
et `/runs/{id}` servent le snapshot. Vérifié E2E au curl sur le binaire.

**Pièges** :
- macOS n'a pas `timeout` : utiliser `curl --max-time` pour borner un flux SSE en test.
- SSE derrière un proxy : sans `X-Accel-Buffering: no`, la réponse est bufferisée et le
  temps réel disparaît.
- Fermer le canal d'un abonné doit se faire sous le même verrou que la publication, sinon
  `Publish` peut écrire sur un canal fermé.

**Reste à faire** : piste front (client SSE + écran), puis le reporter côté kern-orch.

---

## Piste front (2026-07-26)

**Fichiers** : `web/src/styles/tokens.css`, `web/src/styles/fonts.css`,
`web/public/fonts/*.woff2`, `web/src/i18n/fr.ts`, `web/src/runs/{types,merge,useRunStream,RunList}.*`,
`web/src/App.tsx`, `web/src/App.module.css`

**Tests** : `web/src/runs/merge.test.ts`, `web/src/runs/useRunStream.test.ts`,
`web/src/runs/RunList.test.tsx`, `web/src/App.test.tsx`

**Décisions**
- 2026-07-26 : polices auto-hébergées (4 woff2, 72 Ko) — le CDN est interdit par le CLAUDE.md
  et l'app doit tourner hors ligne. Space Grotesk est variable : un fichier couvre tous les poids.
- 2026-07-26 : subset vietnamien retiré, interface française (184 Ko → 72 Ko).
- 2026-07-26 : `tokens.css` est la source de vérité unique de la charte, extraite des
  maquettes ; aucun composant ne code une couleur en dur.
- 2026-07-26 : libellés dans `i18n/fr.ts`, jamais dans un composant (règle CLAUDE.md).
- 2026-07-26 : frontière en puces `<span>` et non en liste imbriquée — un `<ul>` dans un
  `<li>` fait annoncer « liste de N » à chaque run et brouille le comptage des items.

**Pièges front**
- Le scaffold Vite active `erasableSyntaxOnly` : les propriétés de paramètre de constructeur
  (`constructor(public url: string)`) passent les tests mais cassent `tsc -b`.
- jsdom n'a pas `EventSource` : il faut un double via `vi.stubGlobal`.

**Vérifié** : rendu desktop conforme à la charte, polices chargées localement
(`document.fonts.check` à true pour les deux), zéro appel externe dans le bundle, zéro
erreur console, mise à jour live sans rechargement (3 → 4 runs, transitions et fin de run).
**Non vérifié visuellement** : le rendu mobile — `resize_window` n'a pas pris dans la
session navigateur. Le layout une colonne repose sur la media query à 720 px.
