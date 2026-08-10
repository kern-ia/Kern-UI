---
id: okf-022
feature: c8-kernui-proxy
branch: feature/c8-kernui-proxy
status: done
files:
  - internal/memory/client.go
  - internal/httpapi/memory.go
  - internal/httpapi/router.go
  - cmd/kern-ui/main.go
tests:
  - internal/memory/client_test.go
  - internal/httpapi/memory_test.go
decisions:
  - "2026-07-30 : même forme que C5/C6 (internal/tools, internal/steer → internal/memory) — client typé, Enabled(), erreurs typées, non-configuré lu comme 404."
  - "2026-07-30 : Resolve distingue ErrUnknownDocument de ErrUnknownSuggestion en lisant le message d'erreur de kern-memory plutôt que de traiter tout 404 pareil — le proxy garde la distinction plutôt que de l'aplatir."
---

**Quoi** : kern-ui proxifie la moitié lecture+décision de C8 vers kern-memory — quatre
endpoints session-protégés (`GET /documents`, `GET /documents/{id}`,
`POST .../suggestions/{sid}/accept|ignore`) qui présentent `KERN_MEMORY_TOKEN`. Pas de champ
acteur ici : contrairement à C6, une décision sur une suggestion n'a pas de notion de
demandeur à faire respecter en V1.

**Vérifié en réel** : `kern-memory serve` + `kern-ui` (aucun compte/jeton producteur, mode
développement local) + `curl` à travers toute la chaîne — liste, lecture d'un document
seedé avec sa suggestion, `accept` via kern-ui, relecture confirmant `status: accepted` côté
kern-memory à travers le proxy, et un document inconnu qui répond bien 404 de bout en bout.

**Pièges** : aucun — le contrat (JSON avec tags explicites, forme de client C5/C6) était
déjà rodé, repris à l'identique.
