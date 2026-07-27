---
id: okf-007
feature: activity-signal
branch: feature/activity-signal
status: done
files:
  - internal/projection/activity.go
  - internal/projection/projection.go
  - internal/httpapi/activity.go
  - internal/httpapi/router.go
  - web/src/shell/systemState.ts
  - web/src/grimoire/grimoire.ts
  - web/src/views/AgentsView.tsx
  - contracts/kern.activity.v1.json
tests:
  - internal/projection/activity_test.go
  - internal/httpapi/activity_test.go
  - web/src/shell/systemState.test.ts
  - web/src/grimoire/grimoire.test.ts
  - web/src/views/AgentsView.test.tsx
decisions:
  - "2026-07-27 : `Tension` n'a demandé AUCUN contrat — l'échec voyage depuis C3, seul le commentaire de `systemState.ts` était périmé. Moitié de C10 livrée en supprimant du code faux"
  - "2026-07-27 : `kern.activity/v1` est un FRÈRE de step-event, pas un champ — un step décrit un niveau terminé, la génération se passe DANS un niveau"
  - "2026-07-27 : l'événement porte `graph` parce qu'il OUVRE le run — un agent génère avant que son niveau ne se termine, donc il arrive toujours en premier"
  - "2026-07-27 : un run ouvert par l'activité est `running` avec frontière vide — ici vide veut dire « pas encore rapporté », jamais « terminé »"
  - "2026-07-27 : report hors du fil du run + `Flush()` avant sortie de commande — un agent ne doit pas attendre l'interface pour commencer, mais le signal d'arrêt est le dernier du run et serait perdu"
  - "2026-07-27 : garde de fraîcheur par (run, nœud) dans la projection — l'envoi asynchrone permet aux signaux de se doubler"
  - "2026-07-27 : bracket ouvert au spawn, pas au premier token — un provider non-streamant n'aurait jamais été vu comme réfléchissant"
  - "2026-07-27 : bracket fermé en `defer` — un arrêt qui ne partirait qu'en cas de succès laisserait le phare allumé sur un run cassé"
  - "2026-07-27 : CORRECTION — `Bloqué` et `Tension` ne valent que tant que l'échec est le DERNIER MOT sur la chose ; un run cassé il y a une heure laissait rouge pour toujours"
  - "2026-07-27 : `Actif` prime sur `Bloqué`, l'inverse de ce que le premier jet affirmait — un skill qui génère maintenant n'est pas bloqué"
---

**Quoi** : le phare atteint ses quatre couleurs. `Tension` était déjà dérivable et ne
demandait que de retirer du code faux ; `Réflexion` a demandé un troisième contrat,
`kern.activity/v1`, que kern-orch émet au démarrage et à l'arrêt de chaque nœud agent.

**Pièges** :
- Un état permanent affiché avec un libellé au présent est un mensonge : `Bloqué` restait
  allumé indéfiniment après un échec. Corrigé dans le Grimoire ET le phare avec la même règle.
- Avancer le moment où un run devient visible a créé un état inédit — run sans topologie —
  et le message existant se lisait comme définitif. Ajout de `topologyPending`.
- `cat >> f <<'EOF'` avec un corps vide crée le fichier : un test vide fait échouer vitest.
- `npx vitest` depuis la racine charge la mauvaise config ; passer par `make test`.
