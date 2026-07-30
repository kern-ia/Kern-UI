---
id: okf-023
feature: c8-frontend
branch: feature/c8-frontend
status: done
files:
  - web/src/redaction/types.ts
  - web/src/redaction/useDocuments.ts
  - web/src/redaction/useDocument.ts
  - web/src/redaction/api.ts
  - web/src/redaction/relativeTime.ts
  - web/src/redaction/RedactionView.tsx
  - web/src/redaction/RedactionView.module.css
  - web/src/shell/views.ts
  - web/src/shell/AppShell.tsx
  - web/src/i18n/fr.ts
tests:
  - web/src/redaction/useDocuments.test.ts
  - web/src/redaction/useDocument.test.ts
  - web/src/redaction/api.test.ts
  - web/src/redaction/relativeTime.test.ts
  - web/src/redaction/RedactionView.test.tsx
decisions:
  - "2026-07-30 : relativeUpdate est une fonction pure qui rend une forme structurée ({unit, count}) — le texte français est composé dans fr.ts, jamais dans le module de logique."
  - "2026-07-30 : le corps du document est découpé côté vue autour des ancres des suggestions en attente seulement — une suggestion résolue perd son surlignage, ce qui est le comportement voulu plutôt qu'un oubli."
  - "2026-07-30 : Rédaction garde sa sélection de document en état local (pas remonté dans AppShell) — contrairement au run sélectionné pour la pierre de conversation, rien ne doit réagir à quel document est ouvert depuis un autre onglet."
---

**Quoi** : `RedactionView` — sidebar de documents + panneau principal (titre, nombre de
mots, corps, ancre surlignée, carte de suggestion Accepter/Ignorer), promue `live` dans
`views.ts`. V1 lecture + décision seulement, conforme au cadrage de la session : pas
d'édition, pas de génération de suggestion.

**Vérifié en réel** : suite Vitest complète (194 tests) + `tsc --noEmit` + `vite build`
verts, puis un vrai navigateur Chrome contre `kern-memory serve` + `kern-ui` réels — la vue
Rédaction affiche le document seedé et sa suggestion en attente exactement comme la
maquette, un clic réel sur Accepter fait disparaître la carte, et une relecture directe de
kern-memory (`curl` avec le jeton porteur) confirme `status: "accepted"` sur le store lui
appartenant en propre — la décision a bien traversé kern-ui jusqu'à kern-memory, pas
seulement mise à jour dans l'état local du navigateur.

**Pièges** : aucun — dernière des trois branches de C8, le contrat était déjà stable des
deux branches précédentes.
