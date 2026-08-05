---
id: okf-027
feature: hive-timeline-cards
branch: feature/hive-timeline-cards
status: done
files:
  - web/src/runs/hive.ts
  - web/src/runs/HiveGraph.tsx
  - web/src/runs/HiveGraph.module.css
  - web/src/i18n/fr.ts
tests:
  - web/src/runs/hive.test.ts
  - web/src/runs/NestedHive.test.tsx
  - web/src/i18n/fr.test.ts
decisions:
  - "2026-08-05 : la Ruche passe de rangs verticaux à une frise horizontale — rank = colonne (X), les frères d'un rang s'empilent en ligne (Y) à hauteur fixe au lieu d'être répartis par COMPTE sur une largeur fixe. Bug réel corrigé : plusieurs nœuds pilotés par un routeur (pas de cible statique déclarée) tombaient tous sur le même rang de repli et s'écrasaient visuellement — vérifié en conditions réelles sur community-management-agency (6 des 8 nœuds sur un seul rang avant correctif)."
  - "2026-08-05 : cercle + texte SVG remplacé par une carte HTML dans un <foreignObject> — nom + description en langage courant, pastille de statut réutilisant l'emplacement déjà prévu par la maquette pour un avatar génératif futur (design/mockups/Agentic OS.dc.html, section Sous-agents)."
  - "2026-08-05 : la traduction id→{nom, description} vit dans fr.hive.nodeInfo(id), appelée PAR selectNode/closeNode/openNested/closeNested/nestedOf plutôt que par les appelants — un seul endroit traduit, les tests existants qui appellent ces fonctions avec l'id brut (ex. fr.hive.selectNode('prep')) restent corrects sans modification, parce qu'ils passent par la même traduction que le composant."
  - "2026-08-05 : zoom par paliers fixes (0.6/0.8/1/1.25), aucune dépendance ajoutée — cohérent avec la posture du dépôt (zéro dépendance sauf nécessité réelle)."
  - "2026-08-05 : contenu réel sourcé depuis Kern-Orch/skills/prospection/agent_cli.py et Kern-Orch/skills/community-management-agency/agent_cli.py (ce que chaque nœud fait vraiment), pas inventé — repli title-case pour tout id non couvert."
---

**Quoi** : la Ruche des sous-agents devient une frise horizontale zoomable, cartes au lieu
de cercles — nom et description en langage courant, jamais un id technique brut à l'écran.
Corrige un vrai bug d'écrasement trouvé en pilotant `community-management-agency` en
direct dans le navigateur avec le porteur du projet.

**Vérifié en réel** : `npx vitest run` (224 tests, tout vert), `npm run build` propre,
`make build`, puis un vrai run `community-management-agency` redispatché et observé dans
le navigateur — 8 cartes lisibles sans chevauchement, zoom +/- fonctionnel, clic sur une
carte tronquée affiche le nom complet dans le panneau de détail.

**Pièges** : le test `does not repeat the legend inside a nested hive` comptait tout texte
"Actif" à l'écran — cassé par les nouvelles cartes qui affichent aussi leur propre statut
en texte (amélioration d'accessibilité, pas une régression). Corrigé en scopant l'assertion
à la légende (`within(getByRole('list'))`) plutôt qu'à la page entière.
