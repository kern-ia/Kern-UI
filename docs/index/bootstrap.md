---
id: okf-001
feature: bootstrap
branch: feature/bootstrap
status: done
files:
  - cmd/kern-ui/main.go
  - internal/httpapi/router.go
  - web/vite.config.ts
  - web/tsconfig.app.json
  - Makefile
  - .github/workflows/ci.yml
tests:
  - internal/httpapi/router_test.go
  - web/src/App.test.tsx
decisions:
  - "2026-07-26 : backend Go plutôt que Rust/Tauri (îlot dans un écosystème Go, aucun code partageable avec kern-orch/kern-anon)"
  - "2026-07-26 : Wails écarté de la v1 (casse la cross-compilation, impose un runner CI par OS)"
  - "2026-07-26 : ingestion en push depuis kern-orch, pas de lecture de ses checkpoints (dépendre d'un schéma interne n'est pas un contrat)"
  - "2026-07-26 : SSE pour l'état, POST pour le pilotage (flux unidirectionnel, reconnexion native)"
  - "2026-07-26 : SPA servie depuis le disque au bootstrap, go:embed reporté (embed refuse un répertoire vide)"
---

**Quoi** : ossature du binaire kern-ui. Serveur Go (`/healthz`, arrêt gracieux, SPA
statique optionnelle) + SPA React/Vite/TS dont le build atterrit dans
`internal/httpapi/dist`. Makefile, `.env.example`, CI deux jobs. Cross-compilation
vérifiée sur 5 cibles avec `CGO_ENABLED=0`.

**Pièges** :
- Vitest `globals: true` échoue à `tsc -b` tant que `vitest/globals` n'est pas dans
  `types` de `tsconfig.app.json` — les tests passent, le build casse.
- `go:embed dist` refuse un répertoire vide ou absent : impossible d'embarquer avant
  que le front ne soit construit. Servi depuis le disque en attendant.
- Le scaffold Vite importe `index.css` dans `main.tsx` : supprimer le fichier sans
  retirer l'import casse le build.
- `.gitignore` non ancré : le motif `kern-ui` (nom du binaire) ignorait aussi le
  répertoire `cmd/kern-ui/`, qui a failli manquer au premier commit.
