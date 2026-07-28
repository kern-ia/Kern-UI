---
id: okf-012
feature: tls
branch: feature/tls
status: done
files:
  - cmd/kern-ui/exposure.go
  - cmd/kern-ui/main.go
  - internal/httpapi/auth.go
  - internal/httpapi/router.go
tests:
  - cmd/kern-ui/exposure_test.go
  - internal/httpapi/auth_test.go
decisions:
  - "2026-07-28 : une adresse publique en clair fait REFUSER le démarrage, l'avertissement ne suffisait pas — même raisonnement que pour les identifiants manquants"
  - "2026-07-28 : trois issues nommées dans le message d'erreur (certificat, proxy déclaré, rester en local) — un refus sans issue est un mur, pas un garde-fou"
  - "2026-07-28 : `X-Forwarded-Proto` n'est cru QUE si `KERN_UI_TRUST_PROXY` est posé — n'importe quel client peut fabriquer cet en-tête et se déclarer en sécurité"
  - "2026-07-28 : HSTS envoyé seulement sur une connexion chiffrée — sur http il ne veut rien dire, et il épinglerait localhost en https pour un an sur la machine de dev"
  - "2026-07-28 : TLS 1.2 comme plancher"
  - "2026-07-28 : un certificat sans sa clé est une erreur nommée, pas un démarrage en clair"
---

**Quoi** : le manque que l'authentification laissait ouvert. Soit kern-ui sert HTTPS, soit un
proxy inverse déclaré le fait ; sinon il ne sert pas d'adresse publique.

**Défaut corrigé au passage, introduit la veille** : le drapeau `Secure` du cookie dépendait
de `r.TLS`, nul derrière un proxy inverse. Dans le déploiement le plus probable, le cookie de
session partait donc **sans** `Secure` — rejouable en clair. C'est ce que `overTLS` répare.

**Vérifié en réel** : HTTPS direct (HSTS présent, cookie `Secure`), puis derrière un proxy
déclaré (même résultat sur l'en-tête annoncé, et pas de `Secure` sans l'en-tête).
