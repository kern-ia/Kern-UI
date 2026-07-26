---
id: okf-003
feature: app-shell
branch: feature/app-shell
status: done
files:
  - web/src/shell/views.ts
  - web/src/shell/systemState.ts
  - web/src/shell/AppShell.tsx
  - web/src/views/MissingSource.tsx
  - web/src/i18n/fr.ts
tests:
  - web/src/shell/AppShell.test.tsx
  - web/src/shell/systemState.test.ts
  - web/src/views/MissingSource.test.tsx
decisions:
  - "2026-07-26 : les 6 onglets de la maquette existent tous ; 4 déclarent leur source manquante plutôt que d'afficher des données inventées"
  - "2026-07-26 : `views.ts` distingue no-brick (aucune brique dans la roadmap) de no-contract (la brique existe, le contrat non) — promouvoir une vue est une ligne à changer"
  - "2026-07-26 : Espace = tools/skills câblés à la demande, pas une brique MCP — même registre kern-orch que le Grimoire, donc un seul contrat débloque les deux vues"
  - "2026-07-26 : barre de conversation présente mais désactivée, avec la raison affichée : un champ qui avale ce qu'on tape serait pire que pas de champ"
  - "2026-07-26 : `systemState` ne produit que repos et action ; réflexion et tension restent dans le type, aucune brique ne sait les rapporter"
  - "2026-07-26 : deux nav (complète + compacte) avec des libellés distincts — deux nav homonymes sont un défaut d'accessibilité réel, pas seulement un souci de test"
---

**Quoi** : la coquille de l'Agentic OS. En-tête avec balise d'état système et indicateur de
connexion, navigation 6 onglets sur desktop et 4 sur mobile (comme la maquette), barre de
conversation persistante, vue Agents alimentée par les runs kern-orch, 4 vues déclarant
explicitement ce qu'elles attendent.

**Pièges** :
- Deux `<nav>` avec le même `aria-label` : en test le CSS module n'est pas appliqué, donc
  les deux sont visibles et `getByRole('navigation')` échoue. Le vrai problème était
  l'accessibilité, pas le test.
- Un test vérifie que `MissingSource` ne rend aucun `table/ul/ol/canvas/svg` : il casse si
  quelqu'un est tenté de « remplir un peu » une vue non alimentée.

**Reste à faire** : la maquette Agents est un graphe SVG (orchestrateur + ruche), pas des
cartes. Le contrat `kern.step-event/v1` ne transporte que la frontière, pas la topologie du
graphe — il faut l'étendre pour dessiner la ruche. Voir la rétro.
