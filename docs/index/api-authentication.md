---
id: okf-011
feature: api-authentication
branch: feature/api-authentication
status: done
files:
  - internal/auth/password.go
  - internal/auth/session.go
  - internal/auth/token.go
  - internal/auth/accounts.go
  - internal/httpapi/auth.go
  - internal/httpapi/router.go
  - cmd/kern-ui/exposure.go
  - cmd/kern-ui/main.go
  - web/src/auth/useSession.ts
  - web/src/auth/LoginView.tsx
  - web/src/App.tsx
tests:
  - internal/auth/*_test.go
  - internal/httpapi/auth_test.go
  - cmd/kern-ui/exposure_test.go
  - web/src/auth/useSession.test.ts
  - web/src/auth/LoginView.test.tsx
decisions:
  - "2026-07-28 : DEUX identités, jamais une. Producteur = jeton porteur, écriture seule. Personne = session cookie, lecture seule. Les fusionner voudrait dire que le jeton posé sur chaque machine lit aussi tout"
  - "2026-07-28 : PBKDF2-SHA256 600 000 itérations (`crypto/pbkdf2`, standard) plutôt qu'argon2id ou bcrypt — kern-ui garde ZÉRO dépendance, ce qui fait la cross-compilation en une commande. Compromis assumé : argon2id résiste mieux au GPU. À revoir si une base de hachés peut fuir"
  - "2026-07-28 : le binaire REFUSE de démarrer sur une adresse publique sans jeton ni compte — un avertissement se rate, un processus qui ne démarre pas se remarque"
  - "2026-07-28 : `:7777` compte comme public — l'hôte vide lie toutes les interfaces et a l'air innocent"
  - "2026-07-28 : un compte inconnu est vérifié contre un haché leurre — sinon le temps de réponse de la page de connexion est un annuaire du personnel"
  - "2026-07-28 : une seule réponse pour mot de passe faux et compte inexistant, sur le fil ET à l'écran"
  - "2026-07-28 : sessions en mémoire, mortes avec le processus — honnête pour une brique sans stockage durable, et une session ne survit pas à un déploiement"
  - "2026-07-28 : la déconnexion révoque côté serveur, pas seulement le cookie — un jeton recopié fonctionnerait sinon jusqu'à expiration"
  - "2026-07-28 : `kern-ui useradd`, mot de passe sur stdin JAMAIS en argument (historique du shell, liste des processus). Fichier en 0600"
  - "2026-07-28 : rien de configuré = tout ouvert, pour le développement local. Le garde-fou est au démarrage, pas dans le routeur"
  - "2026-07-28 : PAS de champ « demandeur » — aucune mission n'est lancée depuis l'interface, il serait vide ou faux. Il vient avec le pilotage"
---

**Quoi** : l'API n'est plus ouverte. Écran de connexion, sessions, jetons producteurs, et un
binaire qui refuse de s'exposer sans protection.

**Correction que ce chantier a imposée** : j'avais justifié le champ « demandeur » par
« chaque mission enregistrée sans lui est inattribuable pour toujours ». Faux ici — la
projection de kern-ui est un cache jetable, vidé à chaque redémarrage. L'argument vaut pour
les checkpoints de kern-orch, qui persistent, et c'est sa décision.

**Ce qui reste ouvert** : TLS. Sans lui, mot de passe et session passent en clair sur le
réseau ; le démarrage l'annonce, mais l'annoncer n'est pas le régler.
