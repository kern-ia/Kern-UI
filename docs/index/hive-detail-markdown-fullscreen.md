---
id: okf-028
feature: hive-detail-markdown-fullscreen
branch: feature/hive-detail-markdown-fullscreen
status: done
files:
  - web/src/runs/HiveGraph.tsx
  - web/src/runs/HiveGraph.module.css
  - web/package.json
tests:
  - web/src/runs/NestedHive.test.tsx
decisions:
  - "2026-08-05 : react-markdown ajouté (une vraie dépendance, pas contournée à la main) — un agent écrit du markdown réel (titres, gras, listes, voir toute sortie de strategiste/redacteur), le rendre à la main aurait été une réimplémentation fragile d'un problème déjà résolu. Pas de dangerouslySetInnerHTML : react-markdown rend vers des éléments React, aucune injection HTML brute possible depuis une sortie de modèle."
  - "2026-08-05 : le panneau de détail devient une superposition plein écran (position: fixed, inset: 0, role=dialog, aria-modal, Escape pour fermer) — trouvé insuffisant en le montrant en vrai (contenu réel d'un brief stratège, illisible dans une boîte de 60ch sous la frise)."
---

**Quoi** : le panneau de détail d'un nœud (`selectedNode`) rend désormais du vrai markdown
(via `react-markdown`) au lieu du texte brut avec astérisques et dièses littéraux, et
occupe tout l'écran en superposition plutôt qu'une petite boîte sous la frise.

**Vérifié en réel** : `npx vitest run` (227 tests verts), `npm run build` propre, `make
build`, puis un vrai run `community-management-agency` redispatché et le brief du
stratège ouvert dans le navigateur — titres, gras et paragraphes bien rendus, panneau
plein écran, lisible.

**Pièges** : aucun nouveau.
