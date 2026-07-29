---
id: okf-019
feature: espace-tool-widgets
branch: feature/espace-tool-widgets
status: done
files:
  - internal/tools/client.go
  - internal/httpapi/tools.go
  - internal/httpapi/router.go
  - cmd/kern-ui/main.go
  - web/src/espace/types.ts
  - web/src/espace/useTools.ts
  - web/src/espace/useToolValue.ts
  - web/src/espace/EspaceView.tsx
  - web/src/shell/views.ts
  - web/src/shell/AppShell.tsx
  - web/src/i18n/fr.ts
tests:
  - internal/tools/client_test.go
  - internal/httpapi/tools_test.go
  - web/src/espace/useTools.test.ts
  - web/src/espace/useToolValue.test.ts
  - web/src/espace/EspaceView.test.tsx
  - web/src/shell/AppShell.test.tsx
decisions:
  - "2026-07-29 : C5 lu en PULL, pas en push comme C1-C4/C10 — kern-ui appelle kern-orch à la demande (KERN_ORCH_URL/KERN_ORCH_TOKEN), il n'y a rien à pousser pour une valeur demandée à l'ouverture d'un widget."
  - "2026-07-29 : pas de vrai MCP — une API HTTP propriétaire kern-orch suffit à C5 ; kern-ui n'est pas un client agent, un fetch() fait le travail sans la couche protocole."
  - "2026-07-29 : source non configurée (KERN_ORCH_URL vide) répond 404 côté kern-ui, même lecture que le registre non publié — deux faits distincts, deux écrans distincts."
  - "2026-07-29 : seul un tool sans param requis devient une carte. Un param requis n'a pas de config qui l'alimente (même trou que C11) — l'exclure plutôt que dessiner un formulaire que la maquette ne montre pas."
  - "2026-07-29 : erreur de validation kern-orch → 400 côté kern-ui ; échec réseau/kern-orch → 502. Distinction faite via un type d'erreur dédié (`InvalidInputError`), pas un texte à parser."
---

**Quoi** : l'Espace devient vivant (clôt C5 côté kern-ui). kern-ui lit le catalogue de
kern-orch (`GET /api/v1/tools`) et invoque chaque outil sans paramètre requis
(`POST /api/v1/tools/{name}/invoke`) pour peupler une carte — glyphe, nom, métrique, valeur.

**Vérifié en réel** : `kern-orch serve` + `kern-ui` pointé dessus (`KERN_ORCH_URL`),
compte créé via `kern-ui useradd`, connexion au clavier dans un vrai navigateur, onglet
Espace ouvert — la carte `heartbeat` affiche « Battement 17:28:29 », une vraie heure
renvoyée par un vrai subprocess Python derrière kern-orch.

**Pièges** : aucun nouveau — la distinction 400/502 (validation vs panne) a été posée dès
l'écriture plutôt que découverte après coup, en gardant `client.go` d'`internal/tools`
symétrique à son homologue kern-orch.
