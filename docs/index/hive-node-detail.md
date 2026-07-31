---
id: okf-025
feature: hive-node-detail
branch: feature/hive-node-detail
status: done
files:
  - web/src/runs/HiveGraph.tsx
  - web/src/runs/HiveGraph.module.css
  - web/src/i18n/fr.ts
tests:
  - web/src/runs/NestedHive.test.tsx
decisions:
  - "2026-07-31 : convention générique display:<nodeId> dans le state — n'importe quel nœud de n'importe quel graphe peut y écrire son résumé lisible, HiveGraph ne connaît rien de la sémantique d'un graphe particulier. Pas de mapping nœud→clé codé en dur côté frontend."
  - "2026-07-31 : cliquer un nœud SANS sortie encore écrite affiche un message dédié (« rien à montrer pour le moment »), jamais un panneau vide qui pourrait passer pour un bug."
---

**Quoi** : chaque nœud du graphe (`HiveGraph`) devient cliquable/activable au clavier ;
cliquer affiche ce que ce nœud a réellement produit (`run.state['display:<id>']`), dans un
panneau sous le graphe. Une mission cesse d'être des points de couleur — on peut voir ce
que chaque agent a dit.

**Vérifié en réel** : suite Vitest complète (199 tests), `tsc --noEmit`, `vite build` verts.
Le producteur de la convention (`skills/prospection/agent_cli.py`, branche suivante) écrit
`display:<nodeId>` pour chaque nœud — vérifié qu'un graphe SANS producteur de cette clé
affiche proprement le message « rien à montrer » plutôt qu'un panneau vide muet.
