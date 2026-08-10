---
id: okf-032
feature: auto-mode-confirmation
branch: feature/auto-mode-confirmation
status: done
files:
  - web/src/shell/ConversationStone.tsx
  - web/src/shell/ConversationStone.module.css
  - web/src/i18n/fr.ts
tests:
  - web/src/shell/ConversationStone.test.tsx
decisions:
  - "2026-08-07 : détection par convention de nommage (command.endsWith('-auto')) plutôt qu'une liste figée d'un seul skill — generalise à tout futur skill '-auto' sans y retoucher, cohérent avec la convention déjà établie (community-management-agency-auto)."
  - "2026-08-07 : le message reste dans le champ après Annuler (pas effacé) — l'utilisateur peut ajuster et retaper sans tout ressaisir."
---

**Quoi** : une commande `/skill-name-auto` tapée dans la conversation ouvre une modale de
confirmation explicite avant de dispatcher — jusqu'ici l'avertissement ne vivait que dans
le `SKILL.md` du skill, jamais dans l'interface au moment d'activer le mode.

**Vérifié en réel** : `npx vitest run` vert (262 tests, 4 nouveaux couvrant confirmation/
annulation/non-interférence avec les commandes normales), `npx tsc -b` propre. Vérifié
dans un vrai navigateur contre un vrai `kern-ui` : `/community-management-agency-auto
publie ce test` ouvre la modale réelle, `Annuler` la ferme sans dispatcher et préserve le
texte du message pour correction.

**Pièges** : aucun.
