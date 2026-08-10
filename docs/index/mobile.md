---
id: okf-013
feature: mobile
branch: feature/mobile
status: done
files:
  - web/src/styles/tokens.css
  - web/src/shell/stone.ts
  - web/src/shell/ConversationStone.tsx
  - web/src/shell/AppShell.module.css
  - web/src/runs/HiveGraph.tsx
  - web/src/runs/HiveGraph.module.css
tests:
  - web/src/shell/stone.test.ts
decisions:
  - "2026-07-28 : la largeur de bascule vit dans le CSS (`--stone-bottom-inset`), lue depuis le JS — répéter le point de rupture en JS est la façon dont les deux divergent"
  - "2026-07-28 : la ruche GARDE une largeur lisible et défile latéralement, plutôt que d'être comprimée — un graphe de 1000 px réduit à 375 rend ses libellés à 4 px"
  - "2026-07-28 : le défilement s'ouvre au milieu — la mise en page centre le graphe, un téléphone au bord gauche ne verrait que de la marge"
  - "2026-07-28 : la navigation passe AU-DESSUS de la pierre — la pierre est déplaçable, la navigation non ; c'est elle qui doit gagner"
  - "2026-07-28 : une position mémorisée est RECADRÉE au chargement, jamais reprise telle quelle — stockée sur un grand écran, elle est souvent impossible sur un petit"
---

**Quoi** : la contrainte « responsive dès le premier livrable » était écrite depuis le début
et n'avait jamais été regardée. Quatre défauts, dont un bloquant.

**Ce que la vérification a montré, avec 132 tests au vert** :
1. la navigation du bas était masquée par la pierre de conversation — interface inatteignable ;
2. les libellés de la ruche faisaient environ quatre pixels ;
3. la bulle débordait de l'écran à droite ;
4. et, révélé par la première correction : une pierre placée sur grand écran se perdait
   derrière la navigation en passant sur téléphone.

**Méthode** : `resize_window` ne fonctionne pas dans la session navigateur. Une page qui
charge l'application dans trois `<iframe>` aux largeurs d'appareils déclenche réellement les
media queries — et permet de comparer trois tailles d'un coup d'œil.
