---
id: okf-029
feature: marketing-calendar
branch: feature/marketing-calendar
status: done
files:
  - web/src/redaction/marketing.ts
  - web/src/redaction/MarketingView.tsx
  - web/src/redaction/MarketingView.module.css
  - web/src/i18n/fr.ts
  - web/src/shell/AppShell.tsx
  - web/src/shell/AppShell.module.css
tests:
  - web/src/redaction/marketing.test.ts
  - web/src/redaction/MarketingView.test.tsx
decisions:
  - "2026-08-06 : Rédaction sert déjà à l'édition de documents (kern-memory, useDocuments/useDocument/RedactionView) — hypothèse initiale fausse que cet onglet n'était \"branché sur rien\". Corrigé en ajoutant un sous-menu (Mémoire / Marketing) plutôt que d'écraser l'existant."
  - "2026-08-06 : aucun nouveau stockage — le calendrier lit les runs community-management-agency(-auto) déjà reçus par kern-ui via le flux existant (même source que la frise Agents). Persistance en mémoire seulement, limite acceptée explicitement (perdu au redémarrage de kern-ui) plutôt que construire une brique de stockage cette session."
  - "2026-08-06 : calendrier grille dès la V1 (pas une liste), sur demande explicite malgré le fait que beaucoup de dates soient encore [À COMPLÉTER] — un contenu sans date extraite liste sous \"Sans date\" plutôt que d'être silencieusement perdu."
  - "2026-08-06 : BUG RÉEL trouvé en vérifiant en direct — le titre extrait était le commentaire de préambule du rédacteur (\"Cadrage complet... — je rédige directement.\") plutôt que le vrai contenu, quand celui-ci ouvre par une note suivie d'un séparateur \"---\" et d'un titre en gras. Corrigé : titleOf saute le préambule et le titre en gras pour prendre la première ligne de contenu réel, avec test de régression sur le cas exact rencontré."
---

**Quoi** : nouveau sous-onglet "Marketing" dans Rédaction — calendrier grille du contenu
produit par `community-management-agency`(-auto), avec statut (publié/brouillon/refusé/en
cours), plateforme et détail plein écran par élément. "Mémoire" (l'éditeur de documents
existant) devient l'autre sous-onglet, inchangé.

**Vérifié en réel** : `npx vitest run` (247 tests, tout vert), `npm run build` propre,
`make build`, dispatch réel puis vérification dans le navigateur — le premier essai a
révélé le bug de titre (préambule affiché au lieu du contenu), corrigé, second essai :
élément placé au 11/08/2026 avec le vrai titre du post.

**Pièges** : le navigateur a gardé un bundle JS en cache malgré un nom de fichier
haché différent (`index-CUX3-XJU.js` au lieu du nouveau) après plusieurs redémarrages de
`kern-ui` — `location.reload(true)` nécessaire à chaque fois pour forcer le
rechargement, une simple navigation ne suffisait pas.
