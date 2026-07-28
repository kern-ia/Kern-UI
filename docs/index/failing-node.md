---
id: okf-008
feature: failing-node
branch: feature/failing-node
status: done
files:
  - internal/projection/projection.go
  - web/src/runs/hive.ts
  - web/src/runs/types.ts
  - contracts/kern.step-event.v2.failure.json
tests:
  - web/src/runs/hive.test.ts
  - internal/httpapi/contract_test.go
decisions:
  - "2026-07-28 : `error.nodes` au PLURIEL — au singulier la garantie « non nommé donc réussi » serait fausse dès que deux nœuds cassent dans le même niveau"
  - "2026-07-28 : un nœud de la frontière absent de la liste A RÉUSSI — garantie du producteur (`wg.Wait()` attend tout le niveau), pas une déduction de l'interface"
  - "2026-07-28 : liste vide ou absente = repli sur l'ancien comportement, toute la frontière marquée — un producteur qui ne sait pas ne doit pas faire mentir la vue"
---

**Quoi** : la ruche colore le nœud qui a cassé, et lui seul. Avant, toute la frontière
vivante passait au rouge faute de savoir laquelle blâmer.

**Pièges** :
- Un E2E d'échec exige un échec à l'exécution : un `func` inconnu est rejeté au chargement.
- Le moteur renvoyait la première erreur du niveau et jetait les autres, alors qu'il les
  avait toutes.
