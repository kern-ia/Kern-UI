---
id: okf-009
feature: nested-runs
branch: feature/nested-runs
status: done
files:
  - internal/projection/projection.go
  - web/src/runs/nested.ts
  - web/src/runs/HiveGraph.tsx
  - web/src/views/AgentsView.tsx
  - contracts/kern.step-event.v2.nested.json
tests:
  - internal/projection/nested_test.go
  - internal/httpapi/contract_test.go
  - web/src/runs/nested.test.ts
  - web/src/runs/NestedHive.test.tsx
decisions:
  - "2026-07-28 : un run imbriqué est un RUN À PART, référencé par `parent`, jamais replié dans le flux du parent — le compteur de niveaux du parent est une séquence, deux graphes qui avancent dessus le corrompraient"
  - "2026-07-28 : la référence compose à toute profondeur ; imbriquer les topologies aurait demandé un schéma récursif pour ce qui est simplement un autre run"
  - "2026-07-28 : envoyer seulement la FORME de l'enfant a été écarté — une ruche entièrement grise sous un nœud terminé serait pire que rien"
  - "2026-07-28 : les runs imbriqués sortent de la liste des runs — ils sont déjà dessinés dans le nœud qui les a produits, les lister deux fois cacherait lequel est l'histoire complète"
  - "2026-07-28 : `ChildOf` prend le run le plus RÉCENT — un nœud qui rejoue son sous-graphe produit plusieurs runs"
  - "2026-07-28 : dépliage explicite plutôt qu'imbrication permanente — la maquette ne montre pas de ruche imbriquée, on n'invente pas un visuel, on réutilise le même composant"
  - "2026-07-28 : pas de légende dans une ruche imbriquée, elle est déjà à l'écran au-dessus"
---

**Quoi** : un sous-agent n'est plus un point. On le déplie et on voit le run qui s'est
réellement déroulé dedans, dessiné par le même composant — donc la profondeur ne coûte rien.

**Pièges** :
- La prop `nested` est entrée en collision avec la variable locale du même nom. Le
  compilateur l'a attrapée, mais trois fichiers de test ont cessé de compiler d'un coup :
  vitest affiche alors « 98 passed » sans dire que 18 ont disparu. Vérifier le nombre de
  FICHIERS, pas seulement celui des tests.
- `▸` et `▾` ne sont pas dans les polices embarquées et tombent sur un point. `▶` / `▼` oui.
