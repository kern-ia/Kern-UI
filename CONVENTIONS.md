# CONVENTIONS.md — kern-ui

Local authority for this repo, as announced by the org-wide
[CONTRIBUTING.md](https://github.com/kern-ia/.github/blob/main/CONTRIBUTING.md). The rules
shared by all `kern-ia` repos are restated below; the "Specifics" sections cover what belongs
only to `kern-ui`.

## Language

Code, identifiers, and comments are written in English — no exceptions. This applies to
source files, docstrings, commit diffs, and test names. It does not apply to
product-facing UI copy (a deliberate, separate decision — see `CLAUDE.md`) or to
internal documentation such as this file, `README.md`, or `CLAUDE.md`, which stay in
whatever language the team works in day to day.

## Branches

- `main`: default branch, always deployable. Protected — no direct pushes.
- `dev`: integration branch. Protected — no direct pushes.
- Working branches: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `test/<slug>`.
- Any change to `main` or `dev` goes through a Pull Request, never a direct push or a local
  `git merge` followed by a push.
- Merging into `dev`: `--no-ff` merge commit (preserves history). Squash is acceptable for a
  trivial single-commit PR.

## Commits

Conventional Commits: `type(scope): short summary`.

Types used in this repo: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `build`,
`ci`, `release`, `merge`.

The body explains the *why*, not the *what*. No tool signature (`Co-Authored-By`,
`Claude-Session`, or equivalent trailer) in commit messages — the git author is enough.

## Pull Requests

- One subject per PR, linked to the issue or RFC it resolves.
- Uses the PR template inherited from `kern-ia/.github`.
- States the semver impact (patch / minor / major / none) — the `web` module and the Go
  module are versioned together as long as `kern-ui` remains a single deliverable.
- No real personal data (code, fixtures, screenshots, PR text) — synthetic only.

## Style and lint

- Go: `gofmt` + `go vet ./...` are mandatory. No `.golangci.yml` in this repo yet — add one
  (see the compliance report), aligned with the `linters.default: standard` base used by
  `kern-anon` and `kern-link`.
- Web (`web/`): `npm run lint` (ESLint) must pass; `npm test` and `npm run build` are checked
  in CI.
- No `cgo`: cross-compilation over `GOOS`/`GOARCH` must stay a single command (product
  constraint, see `CLAUDE.md`).

## Tests

- `go test -race ./...` for the Go module.
- `npm test` for the `web` module.
- CI (`.github/workflows/ci.yml`) runs both jobs (`go`, `web`) on push to `main`/`dev` and on
  every PR — already the case here, keep it as the reference for the other repos.

## Go module

- Current path: `github.com/yoann/kern-ui`. Does not match the GitHub organization
  (`kern-ia`) hosting the repo — a decision to make at the org level (see the report), not to
  fix unilaterally here while the other modules stay unaligned.

## Documentation

- `README.md` at the root, kept up to date.
- `CLAUDE.md` — agent context, keep it synchronized with actual product decisions.
- `docs/` for design (mockups, dated brainstorms).
- No `CHANGELOG.md`: release notes live in the annotated tag message (org convention, see
  `CONTRIBUTING.md`).

## Security / privacy

See the org-inherited `SECURITY.md`: report via GitHub private vulnerability reporting, never
a public issue. No real PII in code, fixtures, or logs.
