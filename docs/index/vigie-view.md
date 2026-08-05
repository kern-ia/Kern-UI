---
id: okf-026
feature: vigie-view
branch: feature/vigie-view
status: done
files:
  - internal/firewall/client.go
  - internal/firewall/relay.go
  - internal/httpapi/firewall.go
  - internal/httpapi/router.go
  - cmd/kern-ui/main.go
  - web/src/vigie/types.ts
  - web/src/vigie/useBudget.ts
  - web/src/vigie/useDecisions.ts
  - web/src/vigie/VigieView.tsx
  - web/src/shell/views.ts
  - web/src/shell/AppShell.tsx
  - web/src/i18n/fr.ts
  - design/mockups/Agentic OS.dc.html
tests:
  - internal/firewall/client_test.go
  - internal/firewall/relay_test.go
  - internal/httpapi/firewall_test.go
  - web/src/vigie/useBudget.test.ts
  - web/src/vigie/useDecisions.test.ts
  - web/src/vigie/VigieView.test.tsx
decisions:
  - "2026-08-05 : nom d'onglet « Vigie », jamais « AIFirewall » — fr.ts et CLAUDE.md interdisent tout nom de brique à l'écran (« un test échoue si un nom de brique réapparaît »). Le mot nomme la capacité (surveillance), pas le module. Tranché avec l'utilisateur avant le premier fichier."
  - "2026-08-05 : deux sources de données, deux plomberies différentes. Le budget (C4, valeur de jauge lente) est interrogé à la demande — le pattern tools.Client/useToolValue déjà en place pour kern-orch/kern-memory, rien de nouveau à inventer. Les décisions (C3, événements discrets) sont relayées — kern-ui n'avait jamais consommé un flux SSE externe avant cette étape, seulement produit les siens ; relay.go est une pièce neuve, calquée sur handleStream/writeEvent existants."
  - "2026-08-05 : views.ts est un ensemble fermé de six vues explicitement dérivé de design/mockups/Agentic OS.dc.html, qui fait autorité. Ajouter une 7e vue sans mettre à jour la maquette l'aurait rendue fausse. Tranché avec l'utilisateur : la maquette est mise à jour en parallèle du code, pas laissée dériver."
  - "2026-08-05 : pas d'événement snapshot sur /api/v1/vigie/decisions, contrairement à /api/v1/stream — une décision n'a pas d'« état courant » à résumer à la connexion, contrairement à un run. Un navigateur qui se connecte en cours de session commence simplement à voir les décisions à partir de cet instant. Déviation délibérée du contrat de useRunStream, documentée dans useDecisions.ts."
  - "2026-08-05 : le relais retente indéfiniment avec un backoff exponentiel plafonné, jamais ne bloque le démarrage de kern-ui ni ne le fait planter — un pare-feu IA peut ne pas encore tourner. Le backoff se réinitialise après toute connexion qui a atteint une réponse 200 (même si le flux se coupe ensuite), pour qu'une connexion stable qui se coupe une fois ne retente pas avec un délai hérité d'un échec ancien. Vérifié par mutation : désactiver la boucle de reconnexion fait tomber le test dédié."
  - "2026-08-05 : le budget se rafraîchit sur un minuteur (15 s, une seule valeur par défaut raisonnable, pas un nouveau réglage) plutôt que par abonnement — c'est une jauge, pas un événement à ne jamais manquer, même raisonnement que useToolValue."
  - "2026-08-05 : le flux de décisions est borné à 100 entrées côté navigateur (le plus récent en premier) — un flux best-effort selon le propre commentaire de stream.Hub, pas un journal d'événements, une session longue ne doit pas grossir sans limite."
  - "2026-08-05 : capacité « supervision » ajoutée à missing.awaiting même si Vigie expédie en live — cohérence avec le fait que chaque autre vue nomme sa capacité, réutilisable si jamais un jour Vigie repasse en awaiting."
---

**Quoi** : 7e vue de Kern-UI, consommant les contrats C3 (flux de décisions) et C4 (budget)
de l'AI firewall. Backend : `internal/firewall` (client pull + relais SSE), deux routes
`/api/v1/vigie/*`. Frontend : `web/src/vigie/` sur le modèle exact de `web/src/espace/`.

**Vérifié en réel** : `go test ./...` vert (10 paquets), `npm test` vert (219 tests, 29
fichiers), `tsc --noEmit` propre, `oxlint` propre, `npm run build` propre. Scénario complet
bout en bout avec les deux vrais binaires : budget servi via le proxy kern-ui→kern-firewall,
et une décision comportementale déclenchée côté kern-firewall (`POST /v1/actions` ×2 contre
une règle threshold max=1) reçue en direct côté navigateur via `curl -N` sur
`/api/v1/vigie/decisions`, ayant traversé kern-firewall → relais Go de kern-ui → SSE
navigateur sans perte. Mutation testée sur le point le plus fragile (boucle de reconnexion
du relais) : désactiver la relance fait tomber le test dédié.

**Ce qui reste** : aucune sous-vue de détail (clic sur une décision pour voir la trajectoire
complète du run) — hors scope de cette passe. La maquette mobile
(`Agentic OS Mobile.dc.html`) n'a pas été mise à jour ; Vigie est `onMobile: false` dans
`views.ts`, cohérent avec ce choix mais à revisiter si la vue doit devenir accessible sur
téléphone.
