---
id: okf-010
feature: vocabulaire-demo
branch: feature/vocabulaire-demo
status: done
files:
  - web/src/i18n/fr.ts
  - web/src/shell/views.ts
  - web/src/views/MissingSource.tsx
  - CLAUDE.md
tests:
  - web/src/views/MissingSource.test.tsx
  - web/src/shell/AppShell.test.tsx
decisions:
  - "2026-07-28 : run → **mission**. Se comprend sans explication et colle au registre de la maquette (Grimoire, Cerveau, Ruche)"
  - "2026-07-28 : graphe/topologie → **déroulé** · nœud et niveau → **étape** · frontière → **en cours** · skill → **compétence**"
  - "2026-07-28 : une vue non alimentée nomme LA CAPACITÉ MANQUANTE, jamais la brique — « la mémoire des agents n'est pas encore branchée », pas « attend kern-memory »"
  - "2026-07-28 : `ViewSource` perd `brick` au profit de `capability` — le vocabulaire client entre dans le MODÈLE, pas seulement dans les libellés, sinon il se réintroduit à la première vue ajoutée"
  - "2026-07-28 : la distinction no-brick / no-contract disparaît de l'interface — réelle pour nous, invisible pour qui regarde l'écran ; elle reste dans expected-contracts.md"
  - "2026-07-28 : les indices d'exploitation perdent les noms de fichiers et de commandes (`SKILL.md`, `publish-skills`) — un écran vide en démo ne doit pas exposer la mécanique"
  - "2026-07-28 : test de garde — le texte rendu de la coquille entière ne doit correspondre à aucun `kern-*`"
---

**Quoi** : l'interface cesse de parler développeur. Ce produit se montre à des clients, et
« Ce run n'a pas déclaré sa topologie » n'apprend rien à personne hors de l'équipe.

**Ce qui a rendu la reprise bon marché** : tout le texte affiché était déjà centralisé dans
un fichier unique. C'était exactement l'intérêt de la convention, et c'est la première fois
qu'elle rapporte.

**Piège** : changer les libellés sans changer le modèle aurait suffi pour aujourd'hui. Mais
`ViewSource` portait `brick: string` — le prochain écran ajouté aurait renommé une brique à
l'écran sans que rien ne s'y oppose. Le test de garde est là pour ça.
