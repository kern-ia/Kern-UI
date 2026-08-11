# C14 — Journal narratif (Actions récentes de l'agent)

## What

`kern.activity/v1` gagne un champ optionnel `message` (voir `internal/projection/
activity.go`). `Run` gagne `ActivityLog []ActivityLogEntry` (`internal/projection/
projection.go`) : contrairement à `Generating` (dernier mot gagne, effacé à la fin d'un
run), `ApplyActivity` **accumule** chaque signal porteur d'un message — newest-first,
plafonné à 20 entrées (`maxActivityLogEntries`), et le log survit à la fin du run. Nouveau
composant `ActivityLogPanel` (`web/src/views/AgentsView.tsx`, exporté comme
`ApprovalPanel`) affiché à côté du panneau d'approbation dans un `.split2` (Suivi agent ET
Dossier détail, via `DossierDetailView.tsx`) — reprend exactement la disposition et le
style `.actionlog`/`.logline` de `avel-admin.dc.html`.

## Why

Suite de `criteres-equipe.md` et `approval-content.md` : troisième et dernier écart
documenté (`docs/expected-contracts.md`, C14) entre `avel-admin.dc.html` et l'app réelle.
Le project owner a choisi (AskUserQuestion, 2026-08-11) la version « narration dynamique
par skill » plutôt que la version minimale (accumulation des signaux existants + libellés
statiques déjà en place côté kern-ui, zéro changement Kern-Orch) — plus fidèle au mockup,
au prix d'un changement cross-repo côté `kern.activity/v1` (voir `Kern-Orch/docs/index/
0038-activity-narration.md`).

## Décision : réutiliser `display:<nodeID>`, pas un nouveau canal

Kern-Orch narre exactement `state["display:<nodeID>"]` sur le signal d'arrêt d'un nœud —
la même valeur que le panneau détail d'un nœud de la Ruche affiche déjà au clic. Pas de
nouveau protocole à faire écrire aux skills : `courtage-extraction`'s `extraction`,
`interpretation` et `redaction_memo` narrent gratuitement, sans une ligne de Python
changée, puisqu'ils écrivaient déjà cette clé. Un nœud qui n'en écrit pas (la plupart des
nœuds outils, `reception`, `memo_prep`) ne narre rien — silence normal, pas une lacune à
combler ici.

## Vérifié en réel

`go test ./internal/projection/... ./internal/httpapi/...` verts (nouveaux tests :
accumulation, ordre newest-first, plafond à 20 avec suppression du plus ancien, survie à
la fin du run, absence d'entrée quand le message est vide, remontée jusqu'à `GET /api/v1/
runs/{id}`). 308 tests front verts (était 306), `tsc -b` propre.

**Vérification bout-en-bout sur le vrai chemin réseau**, comme pour C13 : un vrai
`kern-ui` reconstruit a reçu un vrai `POST /api/v1/steps` (dossier AF-2288, parqué sur
`confirm_extraction`) puis trois vrais `POST /api/v1/activity` avec `message` — les textes
réels que `courtage-extraction` produirait pour `reception`/`extraction`/`interpretation`
(sourcés depuis `Kern-Orch/skills/courtage-extraction/agent_cli.py`, jamais inventés).
Affiché dans un vrai navigateur : Suivi agent montre les deux panneaux côte à côte, le
journal affiche les trois actions dans le bon ordre (plus récent en premier), avec un
horodatage relatif réel (`il y a 8 h`, réutilisant `fr.dossiers.updated`/`relativeUpdate`
déjà existants — aucun nouveau formatteur créé).

## Left open, on purpose

- Les nœuds outils (Go, synchrones) ne narrent jamais — ils ne passent jamais par le
  crochet `OnActivity` côté Kern-Orch, avant comme après ce changement. Hors scope.
- Les trois contrats C6/C13/C14 documentés dans `docs/expected-contracts.md` sont
  maintenant tous fermés ou en cours ; C6 (canal de pilotage) reste le seul des trois non
  attaqué cette session.
