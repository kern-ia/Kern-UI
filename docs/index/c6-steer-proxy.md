---
id: okf-020
feature: c6-steer-proxy
branch: feature/c6-kernui-proxy
status: done
files:
  - internal/steer/client.go
  - internal/httpapi/steer.go
  - internal/httpapi/router.go
  - internal/projection/projection.go
  - cmd/kern-ui/main.go
tests:
  - internal/steer/client_test.go
  - internal/httpapi/steer_test.go
  - internal/projection/requester_test.go
  - internal/projection/topology_test.go
decisions:
  - "2026-07-29 : même forme que C5 (internal/tools → internal/steer) — client typé, Enabled(), erreurs typées plutôt que des chaînes à parser."
  - "2026-07-29 : l'acteur ne vient jamais du corps de la requête côté kern-ui — lu depuis la session (s.currentUser), jamais depuis ce que le navigateur prétend être."
  - "2026-07-30 : requester manquait réellement sur report.StepEvent côté kern-orch (écart plan/code) — corrigé dans kern-orch avant de pouvoir vérifier ce côté."
  - "2026-07-30 : kind approval absent de projection.validKinds côté kern-ui — un nouveau Kind côté moteur kern-orch est un changement de contrat, pas un détail interne."
---

**Quoi** : kern-ui proxifie C6 vers kern-orch — quatre endpoints session-protégés
(`stop`, `nudge`, `nodes/{node}/decide`, `dispatch`) qui présentent `KERN_ORCH_TOKEN` et
l'acteur de la session en cours, jamais un acteur fourni par le navigateur. `projection.Run`
porte désormais `Requester`, capturé sur le premier événement comme `Topology`.

**Vérifié en réel** : `kern-orch serve` + `kern-ui` + `curl` à travers toute la chaîne —
`/dispatch` via kern-ui lance un vrai run dont le `requester` (l'utilisateur de session)
traverse jusqu'à la projection kern-ui via le push kern-orch ; `decide`/`stop` via kern-ui
agissent réellement sur un run kern-orch vivant.

**Pièges** : deux bugs réels trouvés uniquement en connectant les deux vrais binaires — voir
`docs/index/retro.md` (2026-07-29/30). Ni l'un ni l'autre n'était visible en tests unitaires
isolés côté kern-orch ou côté kern-ui séparément.
