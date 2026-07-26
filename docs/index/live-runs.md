---
id: okf-002
feature: live-runs (chaîne Go)
branch: feature/live-runs
status: wip
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
