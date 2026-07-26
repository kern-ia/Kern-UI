---
id: okf-004
feature: conversation-stone
branch: feature/conversation-stone
status: done
files:
  - web/src/shell/stone.ts
  - web/src/shell/ConversationStone.tsx
  - web/src/shell/ConversationStone.module.css
  - web/src/shell/AppShell.tsx
tests:
  - web/src/shell/stone.test.ts
  - web/src/shell/ConversationStone.test.tsx
decisions:
  - "2026-07-26 : Pointer Events et non Mouse Events comme la maquette — un doigt doit pouvoir attraper la pierre, le responsive est une contrainte du CLAUDE.md"
  - "2026-07-26 : chemin clavier (Entrée/Espace cycle libre → droite → gauche) : un contrôle qu'on ne peut que glisser est inutilisable sans souris"
  - "2026-07-26 : la position est persistée en localStorage — c'est exactement ce que le CLAUDE.md range dans le stockage local de kern-ui (préférences d'affichage)"
  - "2026-07-26 : amarré = la bulle disparaît, seule la pierre reste ; seuil de 70 px repris de la maquette"
  - "2026-07-26 : bulle en deux lignes (champ / note) — sur une ligne la note écrasait le placeholder"
---

**Quoi** : la conversation flotte au-dessus du contenu, attrapable par la pierre runique ᛝ,
et s'amarre contre l'un ou l'autre bord pour se ranger. La logique de position vit dans
`stone.ts`, pure et testée séparément du composant.

**Pièges** :
- **Les handlers de pointeur lisaient `dragging` depuis le state React.** Une rafale de
  `pointermove` arrivant avant le re-render était donc entièrement ignorée. Avec une vraie
  souris ça passait par chance (les événements s'étalent sur plusieurs frames) ; en test
  synthétique rien ne bougeait. State pour le style, refs pour l'arithmétique.
- `setPointerCapture` peut refuser un pointerId synthétique : l'appel est protégé, le
  glisser fonctionne sans.
- jsdom rend un conteneur de taille nulle : les tests de composant couvrent l'amarrage et
  le clavier, l'arithmétique de position est couverte à part dans `stone.test.ts`.
