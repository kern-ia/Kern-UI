# Rétro continue — kern-ui

Ce qui a fonctionné ou non, noté au moment où ça mord. Append only.

## 2026-07-26 — bootstrap

**A fonctionné**
- Vérifier la cross-compilation dès le bootstrap plutôt que de la supposer : c'est
  l'argument qui a fait écarter Tauri, il valait d'être prouvé (5 cibles, `CGO_ENABLED=0`).
- Lire `Kern-Orch/internal/graph/engine.go` avant d'écrire le plan : le hook `StepFunc`
  y est documenté comme la couture d'extension prévue, ce qui a confirmé le choix du push.
- Aligner la version de `modernc.org/sqlite` sur celle de kern-orch (v1.54.0).

**À surveiller**
- `Engine.OnStep` n'a qu'un seul slot (`e.onStep = f`) : brancher un reporter kern-ui
  écraserait le hook de checkpoint. À composer dans `internal/cmd` de kern-orch, sans
  toucher au package `graph`.
- Le `StepFunc` fire par niveau, pas par nœud. La granularité de l'UI sera la frontière,
  pas l'activité d'un agent isolé. Si ça ne suffit pas, c'est kern-obs qui répond, pas
  une instrumentation ad hoc.
- La base locale de kern-ui est une projection jetable. Dès qu'on est tenté d'y stocker
  quelque chose qu'on ne peut pas reconstruire, la frontière entre briques a bougé.

**Piège d'outillage (hors projet)**
- Lancer un serveur en arrière-plan puis `wait` dans le même script bloque jusqu'au
  timeout. Utiliser `pkill` sur le binaire, pas `wait`.

## 2026-07-26 — live-runs (chaîne Go)

**A fonctionné**
- Écrire les tests de la projection avant le code a forcé à trancher explicitement des
  règles qu'on aurait sinon découvertes en production : que faire d'un step rejoué, d'un
  event arrivé après la fin d'un run, d'une frontière aliasée par l'appelant.
- `go test -race -count=3` sur le hub : la première version fermait le canal hors du
  verrou de publication, ce que le détecteur aurait fini par attraper en prod seulement.

**À surveiller**
- Le hub drop quand un navigateur décroche. `Dropped() != 0` veut dire qu'un client a vu
  un trou et dépend de son snapshot. Si ce compteur monte en usage réel, c'est le signal
  qu'il faut coalescer par run plutôt qu'agrandir le buffer.
- Pas de persistance : redémarrer le binaire vide la projection. Assumé tant que
  kern-orch reste autoritatif — le jour où on veut l'historique des runs terminés, la
  bonne réponse est de le redemander à kern-orch, pas de le recopier ici.
