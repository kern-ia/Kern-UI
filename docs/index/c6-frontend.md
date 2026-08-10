---
id: okf-021
feature: c6-frontend
branch: feature/c6-frontend
status: done
files:
  - web/src/steer/api.ts
  - web/src/shell/AppShell.tsx
  - web/src/shell/ConversationStone.tsx
  - web/src/views/AgentsView.tsx
  - web/src/views/AgentsView.module.css
  - web/src/runs/types.ts
  - web/src/i18n/fr.ts
tests:
  - web/src/steer/api.test.ts
  - web/src/shell/ConversationStone.test.tsx
  - web/src/views/AgentsView.test.tsx
  - web/src/shell/AppShell.test.tsx
decisions:
  - "2026-07-30 : sélection de mission remontée dans AppShell (plus dans AgentsView) — la pierre de conversation doit pouvoir nudger la mission ouverte depuis n'importe quel onglet."
  - "2026-07-30 : panneau d'approbation à côté de la ruche, pas dans le SVG — la maquette n'a jamais dessiné d'entrée sur un nœud, un panneau dit la même chose sans deviner un emplacement."
  - "2026-07-30 : commande /skill-name texte… déclenche dispatch ; un message simple nudge la mission ouverte ; sans mission ouverte et sans commande, le champ explique ce qu'il attend plutôt que de rester inerte."
  - "2026-07-30 : l'acteur n'est jamais envoyé par le front — kern-ui (backend) le lit depuis la session, jamais depuis ce qu'un client prétend."
---

**Quoi** : C6 devient utilisable depuis l'interface. La ruche affiche « Arrêter » sur une
mission active (désactivé et expliqué si un autre demandeur l'a lancée), et un panneau
« Valider »/« Refuser » quand un nœud `approval` est actif. La pierre de conversation, jusque
là inerte, envoie `/skill-name texte…` (déclenche un run ou un tool) ou un message simple
(nudge la mission ouverte).

**Deux bugs réels trouvés en pilotant un vrai navigateur, ni l'un ni l'autre visible en
tests unitaires** (voir `docs/retro.md`, 2026-07-29/30) :
- un run parqué sur une approbation ne rapportait rien à kern-ui avant d'être décidé —
  corrigé côté kern-orch en réutilisant le signal d'activité (C10) ;
- `examples/steer.yaml` avait l'approbation comme nœud d'entrée : la topologie (donc
  l'identification du nœud) n'arrive qu'au premier step event, qui n'arrivait jamais avant
  la décision. Réordonné pour correspondre à la forme réelle la plus probable — un nœud
  avant l'approbation. **Limite connue et non résolue** : une approbation en tout premier
  nœud d'un graphe n'a aujourd'hui aucun chemin d'interface pour être décidée.

**Vérifié en réel, dans un vrai navigateur** : connexion, `/heartbeat` (valeur immédiate),
`/planner analyse ceci` (lance un vrai run visible dans la ruche), un run démarré côté
kern-orch avec `requester: demo` affiche « Arrêter » actif, un nœud `confirm` actif affiche
le panneau d'approbation, cliquer « Valider » débloque réellement le run et route vers la
bonne branche.
