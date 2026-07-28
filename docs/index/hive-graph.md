---
id: okf-005
feature: hive-graph
branch: feature/hive-graph
status: done
files:
  - internal/projection/projection.go
  - web/src/runs/hive.ts
  - web/src/runs/HiveGraph.tsx
  - web/src/views/AgentsView.tsx
  - contracts/kern.step-event.v2.json
tests:
  - internal/projection/topology_test.go
  - internal/httpapi/contract_test.go
  - web/src/runs/hive.test.ts
decisions:
  - "2026-07-26 : le statut par nœud est DÉRIVÉ (topologie + frontières vues), aucun contrat supplémentaire — seul l'échec devait voyager"
  - "2026-07-26 : la projection accumule les nœuds visités ; le nœud d'entrée est marqué visité à l'arrivée de la topologie, une frontière ne le nomme jamais"
  - "2026-07-26 : un échec accepté même à l'étape courante — il arrive après le dernier niveau réussi, le traiter comme périmé le perdrait"
  - "2026-07-26 : sur échec, on marque la frontière qui tournait, jamais un nœud précis — le message est une chaîne, désigner un nœud serait une supposition déguisée en fait"
  - "2026-07-26 : une arête dynamique se dessine en tiret pointillé plutôt qu'en cul-de-sac"
  - "2026-07-26 : v1 reste accepté — les nouveaux champs sont optionnels, un producteur v1 reste valide"
---

**Quoi** : la vue Agents dessine le run comme la maquette — orchestrateur en haut,
sous-agents reliés, arêtes animées vers ce qui tourne. Les cartes deviennent le sélecteur de
run. Layout et statuts sont de la logique pure dans `hive.ts`.

**Pièges** :
- `hive.ts` et `Hive.tsx` ne diffèrent que par la casse : collision sur macOS, TypeScript
  refuse de compiler. Renommé `HiveGraph.tsx`.
- La frontière nomme les nœuds **suivants**, donc l'entrée n'y figure jamais et restait
  affichée « en attente » pour toute la vie du run.
- Premier jet : `ReportFailure` envoyait une frontière vide, donc aucun nœud ne pouvait
  jamais être marqué en échec. Corrigé côté kern-orch.
- Le `Record<RunStatus, string>` exhaustif a attrapé le statut `failed` manquant à la
  compilation, avant tout test.
