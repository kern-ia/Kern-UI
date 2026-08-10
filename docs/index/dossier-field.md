# Dossier field — ingestion and dispatch proxy

## What

`internal/projection`'s `StepEvent`/`Run` gain a `Dossier string` field, ingested
exactly like `Requester` (rides the first event only, kept for the run's life).
`internal/httpapi/steer.go`'s `handleDispatch` accepts an optional `dossier` in the
request body and forwards it to `internal/steer.Client.Dispatch`, which now takes a
`dossier` param alongside `actor` — unlike `actor` (always the session user, never
client-supplied), `dossier` **is** client-supplied: it names a business case, not an
identity.

## Why

Built for the Avel Finances advisor console's Dossiers list — see
`docs/index/theming-convention.md` for why a real backend field was chosen over reusing
`requester`, and `Kern-Orch/docs/index/0037-dossier-field.md` for the Kern-Orch half of
this same change (`dossier` mirrors `requester`'s plumbing exactly, in both repos).

## Found along the way

`requester` was a real, tested wire field on `kern.step-event/v2` that neither README's
canonical contract table documented. Fixed alongside `dossier` in both repos' READMEs
rather than left as a second undocumented field.

## Verified

`go test ./...` green (`internal/projection`, `internal/steer`, `internal/httpapi`
including the contract fixture test, which now strictly decodes `dossier` too since
`internal/httpapi/contract_test.go`'s `DisallowUnknownFields()` would otherwise reject
the updated fixture — that dependency is what caught this needing `projection.StepEvent`
changed before the fixture could be updated, not an assumption).
