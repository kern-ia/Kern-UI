# CONVENTIONS.md — kern-ui

Autorité locale pour ce repo, comme annoncé par le [CONTRIBUTING.md](https://github.com/kern-ia/.github/blob/main/CONTRIBUTING.md)
de l'organisation. Les règles communes à tous les repos `kern-ia` sont reprises ci-dessous ;
la section « Spécificités » couvre ce qui n'appartient qu'à `kern-ui`.

## Branches

- `main` : branche par défaut, toujours déployable. Protégée — aucun push direct.
- `dev` : branche d'intégration. Protégée — aucun push direct.
- Branches de travail : `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `test/<slug>`.
- Toute modification de `main` ou `dev` passe par une Pull Request, jamais par un push direct
  ni un `git merge` local suivi d'un push.
- Merge vers `dev` : merge commit `--no-ff` (préserve l'historique). Squash toléré pour une PR
  triviale à un seul commit.

## Commits

Conventional Commits : `type(scope): résumé court`.

Types utilisés dans ce repo : `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`,
`build`, `ci`, `release`, `merge`.

Le corps explique le *pourquoi*, pas le *quoi*. Aucune signature d'outil (trailer
`Co-Authored-By`, `Claude-Session` ou équivalent) dans les messages de commit — l'auteur du
commit git suffit.

## Pull Requests

- Un seul sujet par PR, liée à l'issue ou la RFC qu'elle résout.
- Utilise le template PR hérité de `kern-ia/.github`.
- Déclare l'impact semver (patch / minor / major / none) — le module `web` et le module Go
  sont versionnés ensemble tant que `kern-ui` reste un livrable unique.
- Aucune donnée personnelle réelle (code, fixtures, captures, texte de la PR) — uniquement
  du synthétique.

## Style et lint

- Go : `gofmt` + `go vet ./...` obligatoires. Pas de `.golangci.yml` dans ce repo aujourd'hui —
  à ajouter (voir rapport de conformité) en s'alignant sur la base `linters.default: standard`
  utilisée par `kern-anon` et `kern-link`.
- Web (`web/`) : `npm run lint` (ESLint) doit passer, `npm test` et `npm run build` vérifiés en CI.
- Aucun `cgo` : la cross-compilation `GOOS`/`GOARCH` doit rester une seule commande
  (contrainte produit, voir `CLAUDE.md`).

## Tests

- `go test -race ./...` pour le module Go.
- `npm test` pour le module `web`.
- CI (`.github/workflows/ci.yml`) exécute les deux jobs (`go`, `web`) sur push vers `main`/`dev`
  et sur chaque PR — c'est déjà le cas ici, à garder comme référence pour les autres repos.

## Module Go

- Chemin actuel : `github.com/yoann/kern-ui`. Ne correspond pas à l'organisation GitHub
  (`kern-ia`) qui héberge le dépôt — décision à trancher au niveau de l'org (voir rapport),
  pas à corriger unilatéralement ici tant que les autres modules ne sont pas alignés.

## Documentation

- `README.md` à la racine, à jour.
- `CLAUDE.md` — contexte agent, conserver synchronisé avec les décisions produit réelles.
- `docs/` pour la conception (maquettes, brainstormings datés).
- Pas de `CHANGELOG.md` : les notes de version vivent dans le message de tag annoté
  (convention org, voir `CONTRIBUTING.md`).

## Sécurité / confidentialité

Voir `SECURITY.md` hérité de l'org : signalement via GitHub private vulnerability reporting,
jamais d'issue publique. Aucune PII réelle dans le code, les fixtures ou les logs.
