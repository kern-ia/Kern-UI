---
id: okf-024
feature: demo-approval-plan-text
branch: feature/demo-approval-plan-text
status: done
files:
  - web/src/views/AgentsView.tsx
  - web/src/views/AgentsView.module.css
tests:
  - web/src/views/AgentsView.test.tsx
decisions:
  - "2026-07-31 : run.state porte l'état complet du graphe (graph.State.MarshalJSON : {step,frozen,data,zones}), pas un objet plat — confirmé en lisant le Go, pas supposé. Une valeur écrite par un nœud agent vit sous state.data, jamais à la racine."
  - "2026-07-31 : aucun changement Go — le pipe StepEvent → projection.Run → Run TS portait déjà l'état complet (C6). Seul le rendu React manquait."
  - "2026-07-31 : vérification en vrai via curl a buté sur une vraie course (nudge envoyé après StartRun perd systématiquement contre un nœud tool quasi instantané) — exactement la raison pour laquelle Dispatch nudge AVANT de lancer la goroutine du moteur. La preuve de bout en bout représentative passe par Dispatch (répétition du 2026-08-01), pas par un curl manuel non représentatif du vrai chemin."
---

**Quoi** : `ApprovalPanel` affiche désormais `run.state.data.plan_propose` (au-dessus de
Valider/Refuser) quand un nœud d'approbation le porte — approuver une décision qu'on ne
peut pas lire n'est pas une vraie revue. Nouvelle fonction pure `planProposed(run)`, testée
sans réseau.

**Vérifié en réel** : suite Vitest complète (196 tests), `tsc --noEmit`, `vite build` verts.
Le contrat exact (`state.data`, pas `state` à plat) confirmé en lisant
`Kern-Orch/internal/graph/state.go`'s `MarshalJSON`, pas supposé depuis un exemple. Une
tentative de vérification en vrai navigateur via `curl` a révélé une vraie course
(nudge après `StartRun` arrive après qu'un nœud tool quasi instantané ait déjà avancé le
graphe) — non représentative du vrai chemin (`Dispatch` nudge avant de lancer la
goroutine, donc sans cette course) ; la preuve de bout en bout complète est réservée à la
répétition avec le skill `prospection` réel.
