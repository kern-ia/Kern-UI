# Critères banques & Équipe — les deux onglets manquants du mockup

## What

Deux nouveaux onglets réels, backend + frontend, complétant les 5 vues du mockup
`avel-admin.dc.html` (jusqu'ici seulement 3 sur 5 étaient construites) :

- **Critères banques** (section CONFIGURATION) — `GET /api/v1/criteria`, proxy de la
  couche déclarative de kern-memory (`QueryMemory(kind:"okf")`, sans tags → tout renvoyer).
  Frontend : `web/src/criteres/` (`CriteriaView`, `useCriteria`), cartes affichant
  `memory.text` + tags.
- **Équipe** (section COMPTE) — `GET /api/v1/accounts`, `Accounts.Names()` nouveau sur
  `internal/auth/accounts.go` (noms seulement, jamais les hash). Frontend :
  `web/src/equipe/` (`TeamView`, `useTeam`), cartes avec avatar-initiales
  (`shell/initials.ts`, extrait de `AppShell.tsx` pour éviter la duplication).

Sidebar étendue à 3 sections (`fr.nav.sections.{operations,configuration,compte}`),
`ViewDef.section` gagne la valeur `'compte'`.

## Why

Le project owner a pointé, après la refonte sidebar (`sidebar-shell.md`), que 2 des 5
onglets du mockup manquaient encore côté app réelle : "il manque deux onglet ensuite le
contenu des onglet tu ne les à pas corrgier on à dit que le designe pars de ce nouveau
mockup." Le mockup fait foi dans son intégralité, pas seulement sa structure de chrome —
un onglet visuellement présent dans `avel-admin.dc.html` mais non branché derrière était
un travail resté partiel, exactement le pattern d'erreur déjà corrigé deux fois avant
dans cette session.

## Sources de données vérifiées avant de construire (discipline "ne pas fabriquer")

- **Critères** : lu `kern-memory/internal/memory/okf/store.go`, confirmé que
  `Query(kind:"okf", tags:nil)` retourne bien toute la couche déclarative — pas une
  supposition. Scope volontairement limité à `kind:"okf"` (jamais la couche vectorielle,
  qui n'a pas de clé de liste pertinente pour "une règle, un critère") — testé
  (`TestListingCriteriaProxiesTheOKFLayerOnly` vérifie `kind == "okf"` dans la requête
  sortante).
- **Équipe** : lu `internal/auth/accounts.go`, confirmé qu'aucune méthode de listing
  n'existait — un vrai petit trou à combler, pas un grand à documenter et reporter.
  `handleListAccounts` n'expose que les noms (jamais `s.cfg.Accounts` en entier, qui
  contient les hash) — décision de sécurité documentée dans le commentaire du handler.

Aucun contenu inventé : pas de liste de banques fictive, pas de compte fictif.

## Bug évité, trouvé par inspection du pattern existant (pas par un test)

`handleListAccounts` appelait d'abord `s.cfg.Accounts.Names()` directement ; relecture de
`auth.go` a montré que tout usage existant de `Config.Accounts` le garde nul-safe
(`s.cfg.Accounts == nil`) puisque le champ peut être nil. Garde ajoutée avant tout risque
de panic en production.

## Vérifié en réel

`go build ./...`, `go test ./...` (tous les packages Go verts), `npx tsc -b` propre,
`npm test -- --run` → **298 tests verts** (était 287 avant cette passe). Build réel
`VITE_BRAND=avel npm run build` (236 modules), servi par un vrai `kern-ui` reconstruit
(le premier binaire de démo était **stale** — routes absentes, 404 confirmé par `curl`
avant correction), capture d'écran confirmant les 3 sections de sidebar et les 5 onglets.

Les deux nouveaux onglets affichent, en conditions réelles de démo (aucune source mémoire
branchée, aucun compte configuré sur cette instance), leurs états vides réels et corrects
— "Aucune source de critères n'est connectée" / "Aucun compte pour le moment" — et non
une erreur ni un contenu fabriqué.

## Left open, on purpose

`docs/expected-contracts.md` C13/C14 restent les seuls vrais trous backend documentés de
la passe précédente (contenu structuré d'approbation, journal narratif) — sans lien avec
ces deux onglets, qui avaient chacun une source de données réelle déjà disponible.
