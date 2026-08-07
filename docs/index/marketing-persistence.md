---
id: okf-031
feature: marketing-persistence
branch: feature/marketing-persistence
status: done
files:
  - internal/memory/client.go
  - internal/httpapi/marketing.go
  - internal/httpapi/router.go
  - web/src/redaction/marketing.ts
  - web/src/redaction/marketingApi.ts
  - web/src/redaction/MarketingView.tsx
tests:
  - internal/memory/client_test.go
  - internal/httpapi/marketing_test.go
  - web/src/redaction/marketing.test.ts
  - web/src/redaction/marketingApi.test.ts
decisions:
  - "2026-08-07 : réutilise kern-memory (EPIC-13, couche .okf) plutôt qu'un troisième mécanisme de stockage — le calendrier marketing devient un consommateur de plus de kern-memory, pas une brique de persistance maison."
  - "2026-08-07 : périmètre volontairement resserré au calendrier marketing, pas à internal/projection tout entier — l'historique complet des runs (vue Agents) reste en mémoire, c'est un changement d'architecture plus large et non demandé."
  - "2026-08-07 : synchronisation en tâche de fond, à la fois écriture et lecture — un échec de kern-memory ne doit jamais casser le calendrier affiché, seulement faire échouer silencieusement cette synchronisation-là."
  - "2026-08-07 : côté kern-memory, la clé de mémoire est l'id du run (stable, un item = un run) — nécessitait que okf.Store.Write upserte plutôt que d'échouer sur un id répété (voir kern-memory docs/index/0003-okf-upsert.md, corrigé dans la foulée)."
---

**Quoi** : le calendrier marketing (Rédaction → Marketing) survit maintenant à un
redémarrage de `kern-ui`. Les items dérivés en direct des runs connus (`mergeItems`)
sont synchronisés en tâche de fond vers `kern-memory` (`.okf`, tag `marketing`, id = run
id) ; au chargement, les items persistés comblent ceux dont le run n'est plus connu en
mémoire (ex. après un redémarrage).

**Vérifié en réel** : `go test ./...` (kern-ui) vert, `npx vitest run` vert (258 tests),
`npx tsc -b` propre. Bout en bout réel : écriture d'un item via l'API `kern-ui` réelle
(session authentifiée), **redémarrage réel de `kern-ui`**, item retrouvé intact via
`GET /api/v1/marketing/items` après redémarrage — la persistance annoncée est
effectivement vérifiée, pas seulement plausible.

**Pièges** : `toDTO` utilisait `Date.toISOString()` pour formater la date — bug réel trouvé
en écrivant le test, ça convertit en UTC d'abord et décale le jour calendaire près de
minuit dans tout fuseau non-UTC (`2026-08-10` local devenait `2026-08-09` dans le corps de
la requête). Corrigé en formatant depuis les composants locaux de la date
(`getFullYear`/`getMonth`/`getDate`), jamais `toISOString()` pour une date-sans-heure.
