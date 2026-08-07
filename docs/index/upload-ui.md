---
id: okf-033
feature: upload-ui
branch: feature/upload-ui
status: done
files:
  - internal/steer/client.go
  - internal/httpapi/router.go
  - internal/httpapi/upload.go
  - web/src/steer/api.ts
  - web/src/shell/ConversationStone.tsx
  - web/src/shell/ConversationStone.module.css
  - web/src/i18n/fr.ts
tests:
  - internal/steer/client_test.go
  - internal/httpapi/upload_test.go
  - web/src/steer/api.test.ts
  - web/src/shell/ConversationStone.test.tsx
decisions:
  - "2026-08-07 : l'attache de fichier s'ajoute au mécanisme de dispatch existant (`/skill texte…`) plutôt que de construire un écran dédié à courtage-extraction — un fichier joint devient le texte du dispatch (le chemin uploadé), cohérent avec le fait que tout dispatch passe déjà par ce même chat."
  - "2026-08-07 : upload puis dispatch en deux appels séquentiels côté client (pas un seul appel combiné côté serveur) — kern-orch expose déjà /api/v1/uploads et /api/v1/dispatch séparément, pas de nouvelle route composite à inventer."
---

**Quoi** : un fichier peut être joint au chat (icône 📎) avant une commande `/skill-name` —
il est uploadé en premier, et le chemin retourné devient le texte du dispatch (même
convention que le chemin Telegram ou un chemin tapé à la main). Fonctionne pour n'importe
quel skill dispatché depuis le chat, pas seulement `courtage-extraction`.

**Vérifié en réel** : `go test ./...`, `npx vitest run` (267 tests) et `npx tsc -b` verts.
Bout en bout réel dans un vrai navigateur contre un vrai `kern-ui` + `kern-orch` : fichier
joint (chip visible avec bouton de retrait), `/courtage-extraction` tapé et envoyé,
« Mission « courtage-extraction » lancée. » affiché, fichier réellement présent sur disque
côté `kern-orch`, run réel démarré.

**Pièges** : aucun côté logique — un aléa d'automatisation navigateur (l'icône 📎 déclenche
un vrai sélecteur de fichier natif, inutilisable en script) a nécessité de peupler le
`<input type="file">` directement via JS pour la vérification, sans rapport avec le code
livré.
