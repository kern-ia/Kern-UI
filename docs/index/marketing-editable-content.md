---
id: okf-030
feature: marketing-editable-content
branch: feature/marketing-editable-content
status: done
files:
  - web/src/redaction/MarketingView.tsx
  - web/src/redaction/MarketingView.module.css
  - web/src/i18n/fr.ts
tests:
  - web/src/redaction/MarketingView.test.tsx
decisions:
  - "2026-08-06 : le panneau de détail passe de paragraphes en lecture seule à une <textarea> éditable + bouton Copier — pas de republication réelle (choix explicite de l'utilisateur) : éditer sert à corriger avant de coller à la main, pas à relancer un envoi."
  - "2026-08-06 : le panneau est keyé par runId (React remonte le composant à l'ouverture d'un autre élément) — une édition laissée sans être copiée sur un élément ne doit jamais se retrouver sur le suivant."
---

**Quoi** : le panneau de détail d'un élément du calendrier marketing devient éditable
(zone de texte) avec un bouton "Copier" qui copie le texte courant (édité ou non), au
lieu d'un simple affichage.

**Vérifié en réel** : `npx vitest run` (250 tests, tout vert), `npm run build` propre,
`make build`, dispatch réel, édition du texte dans le navigateur, clic sur Copier,
`navigator.clipboard.readText()` confirme que le presse-papiers contient bien le texte
édité (pas l'original).

**Pièges** : aucun nouveau.
