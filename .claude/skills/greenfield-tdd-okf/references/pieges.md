# Pièges connus

Fichier append-only : ajouter chaque nouveau piège sous la section de la stack concernée
(créer la section si besoin, la dater). Ne consulter que les sections correspondant à la
stack du projet en cours — inutile de charger le reste en contexte.

## Génériques (toute stack)
- Webhooks inter-services : HMAC-SHA256 hex + comparaison timing-safe, contrat de payload
  partagé (schéma validé des deux côtés).
- Numérotation légale : transaction + contrainte unique (memberId, year, seq).
- Feature qui a besoin d'un secret/SMTP externe : prévoir un mode simulé (jsonTransport)
  pour que l'app tourne sans config ; le vrai transport s'active si la variable d'env est présente.
- Rendre en headless une page protégée : jeton court (JWT) lié au chemin, autorisé dans le proxy.
- Intl fr-FR : séparateurs = espaces insécables ; comparer via le formateur, pas une chaîne écrite.

## Next 16 / TypeScript (2026-07, projet CRM_TEAM)
- npm workspaces + `exports` + `turbopack.root` pour un package TS partagé.
- jose/crypto sous vitest jsdom → `// @vitest-environment node` sur les tests de services.
- tsx/seeds : `import "dotenv/config"` obligatoire.
- Next : `new Response(new Uint8Array(buffer))` — BodyInit n'accepte pas Buffer directement.
- Drag & drop : HTML5 dataTransfer + useOptimistic + server action typée, zéro dépendance.

## Prisma 7 (2026-07)
- Generator `prisma-client`, prisma.config.ts + dotenv, driver adapter requis.

## Python & interop Python ↔ TS (2026-07)
- pydantic→zod : `by_alias=True, exclude_none=True` (zod `.optional()` refuse null).
- Scrapling : navigateurs via l'exe `scrapling install`, pas `python -m scrapling` ; le
  Playwright ainsi installé est réutilisable pour du rendu PDF (ne pas réembarquer Chromium).

## Go + contrats inter-services (2026-07, projet Kern)
- **Fixture de contrat exécutable** : le même fichier JSON dans `contracts/` des deux repos,
  chaque côté assertant contre lui (le producteur : « j'émets exactement ça » ; le
  consommateur : « j'accepte exactement ça »). La dérive devient un test rouge, pas une
  question de discipline. Attention : si deux fichiers de test du même paquet assertent la
  même fixture, les patcher ensemble.
- **Un identifiant qui ressemble à un autre n'est pas le même.** Avant de joindre deux
  domaines sur un nom, vérifier que le lien est déclaré et non deviné. Une jointure par
  ressemblance de nommage est fausse en silence.
- **Une spec écrite depuis une maquette est plus large que le contrat réel.** Systématiquement
  interroger chaque champ : que vaut-il aujourd'hui chez le producteur ? Un champ qui vaut
  la même chose sur toutes les lignes ne transporte aucune information.
- **Ne jamais faire traverser un chemin de fichier** : c'est un interne, pas un contrat.
- **404 vs 200 vide** : « aucun producteur n'a parlé » et « le producteur n'a rien » sont deux
  faits distincts. Les confondre fait afficher un écran qui affirme ce qu'on ignore.
- Un état ressource publié en ENTIER à chaque fois évite d'inventer un protocole de
  suppression. Valable tant que la charge tient dans un paquet.
- Vérifier un état « en cours » en E2E demande un vrai travail lent : un stub instantané
  montre l'état final et laisse croire que la dérivation marche.
- **Struct Go sans tag `json:"..."` → sérialise en PascalCase sur le fil.** `go test`
  ne le voit jamais (assertions sur la struct décodée, pas sur le JSON brut) ; seul un
  vrai `curl` contre le serveur le révèle. Poser les tags dès l'écriture d'un type destiné
  à un contrat, pas après coup.
