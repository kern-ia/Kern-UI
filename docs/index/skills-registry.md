---
id: okf-006
feature: skills-registry
branch: feature/registry-contract
status: done
files:
  - internal/registry/registry.go
  - internal/httpapi/registry.go
  - internal/httpapi/router.go
  - internal/projection/projection.go
  - web/src/grimoire/grimoire.ts
  - web/src/grimoire/useRegistry.ts
  - web/src/grimoire/GrimoireView.tsx
  - web/src/shell/views.ts
  - contracts/kern.registry.v1.json
tests:
  - internal/registry/registry_test.go
  - internal/httpapi/registry_test.go
  - internal/httpapi/contract_test.go
  - web/src/grimoire/grimoire.test.ts
  - web/src/grimoire/useRegistry.test.ts
  - web/src/grimoire/GrimoireView.test.tsx
decisions:
  - "2026-07-27 : contrat `kern.registry/v1` en PUSH sur POST /api/v1/registry, second URL `KERN_REGISTRY_REPORT_URL` — jamais une route sœur devinée depuis celle des steps, l'URL est tout le contrat"
  - "2026-07-27 : pas de champ `wired` — dans kern-orch un skill chargé EST disponible, le champ vaudrait true partout et n'apprendrait rien"
  - "2026-07-27 : pas d'id distinct du nom — le registre de kern-orch est déjà indexé par nom, en inventer un second serait une clé qui n'existe pas chez le producteur"
  - "2026-07-27 : `Dir` ne traverse pas le contrat — un chemin de fichier est un interne"
  - "2026-07-27 : catalogue republié EN ENTIER, jamais patché — sinon il faut un message de suppression, un second protocole à rater"
  - "2026-07-27 : 404 sur GET tant que rien n'est publié — 'aucun producteur' et 'producteur sans skill' sont deux faits différents et deux écrans différents"
  - "2026-07-27 : une publication invalide laisse la précédente debout — un producteur qui pousse n'importe quoi ne doit pas pouvoir vider la vue"
  - "2026-07-27 : `skill` AJOUTÉ au nœud de topologie (C2, additif, optionnel) — l'id d'un nœud n'est pas un nom de skill (`greet` exécute `planner`), sans ce champ le statut des sous-agents serait une supposition"
  - "2026-07-27 : le statut des sous-agents réutilise `nodeStatus` de la ruche — la ruche et le Grimoire ne doivent jamais être en désaccord sur qui tourne"
  - "2026-07-27 : fetch sur ouverture de la vue, pas d'abonnement SSE — un registre bouge quand on installe un skill, pas quand un graphe avance"
  - "2026-07-27 : Espace reste sans contrat mais nomme désormais C5 (lecture des outils), plus kern-orch en général"
  - "2026-07-27 : le `+` de création est rendu DÉSACTIVÉ et explique kern-pilot — comme la pierre de conversation, jamais un bouton qui ne fait rien en silence"
---

**Quoi** : le Grimoire devient vivant. kern-orch publie son catalogue de skills, kern-ui le
sert et le dessine en deux colonnes — Compétences (`tool`) à gauche, Sous-agents (`agent`) à
droite, chacun avec son état dérivé des runs en cours. Deuxième contrat en service après
`kern.step-event`.

**Pièges** :
- **L'id d'un nœud n'est pas un nom de skill.** Découvert en écrivant le statut : `hello.yaml`
  déclare `id: greet` / `skill: planner`. Dériver depuis les ids aurait produit un statut faux
  partout, et faux en silence. C'est ce qui a motivé l'ajout de `skill` à la topologie.
- Le `StepFunc` ne fire qu'à la FIN d'un niveau : pendant les 120 s du premier agent, kern-ui
  ne connaît pas encore le run. Pour vérifier « Actif » en vrai il faut attendre la seconde
  frontière, pas la première.
- `oxlint` refuse un `catch (error)` dont le paramètre n'est pas utilisé — `catch {}` suffit.
- `resize_window` de l'extension Chrome répond « succès » sans redimensionner : le rendu
  mobile reste non vérifié visuellement (déjà noté au jalon précédent).
