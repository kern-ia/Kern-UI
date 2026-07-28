# CLAUDE.md — Conventions du repo Kern-UI

## Contexte
`kern-ui` est la **brique interface** de l'écosystème Kern (voir la cartographie dans
`../Kern-Orch/docs/ROADMAP.md`, où elle figure comme brique externe au CORE). Le travail
des agents se passe aujourd'hui dans un terminal : invisible, non pilotable, impossible à
reprendre en main. **Problème n°1 : rendre lisible et pilotable ce que font les agents,
sous-agents, skills et serveurs MCP.** Usage entreprise : **plusieurs utilisateurs
simultanés**, tranché au brainstorming du 2026-07-28 (`docs/brainstorming_28_07_2026.html`,
proposition 02). Cette ligne disait l'inverse jusque-là — voir `docs/a-trancher.md`.

## Objectifs
1. Afficher en temps réel l'état des runs orchestrés par `kern-orch`.
2. Piloter ces runs (steer, queue, replan, nudge) — contrat `kern-pilot`.
3. Rendre la mémoire consultable et corrigeable — contrat `kern-memory`.
4. Exposer le Grimoire (skills & agents) et l'Espace (widgets MCP).
5. Un binaire desktop, mobile et instance centralisée à partir d'un seul artefact.

## Contraintes
- **`kern-ui` est une brique autonome : elle ne dépend jamais des internes d'une autre
  brique**, uniquement de contrats neutres (subprocess/JSON-lines, API déclarée).
- Responsive desktop et mobile dès le premier livrable.
- Go pur, sans cgo : la cross-compilation `GOOS`/`GOARCH` doit rester une seule commande.
- La direction artistique des maquettes fait foi (fond `#0d0a07`, or `#e8c98a`,
  Cinzel pour les titres, Space Grotesk pour le texte).

## Décisions techniques
- Backend : **Go pour cette version**, binaire unique servant le SPA et poussant l'état en
  temps réel. Cohérent avec `kern-orch` et `kern-anon`, et cross-compilable en une commande.
- Front : React + Vite + TypeScript, servi par le binaire. Mobile via PWA.
- Coquille native : **hors périmètre de cette version**, Tauri probable ensuite. Deux
  questions la trancheront, pas le débat : (1) le mobile doit-il être natif — stores et push
  — ou la consultation suffit-elle ? (2) l'application des politiques doit-elle partager le
  processus de la surface d'approbation ? Rien n'est perdu : une coquille Tauri enveloppe
  ce même SPA. Voir `docs/next-steps.md`.
- Rust reste pertinent pour `kern-exec`, `kern-guard` et `kern-policy` : elles touchent le
  confinement au niveau syscall, où Go est mauvais (threads du runtime vs seccomp par
  thread, cgo requis, cross-compilation cassée). Pas pour l'interface, qui ne fait que de
  la glu réseau.
- `kern-ui` ne pilote pas les LLM et ne stocke ni l'état des runs ni la mémoire :
  `kern-orch` checkpointe, `kern-memory` mémorise. Sa base locale ne contient que ce qui
  lui appartient — disposition des widgets, préférences, cache d'affichage.
- Ingestion en **push** : `kern-orch` poste chaque niveau terminé sur
  `POST /api/v1/steps` (`KERN_STEP_REPORT_URL` de son côté). Jamais de lecture de ses
  checkpoints — un schéma interne n'est pas un contrat.
- Temps réel : **SSE** (`GET /api/v1/stream`, snapshot puis mises à jour), pilotage en POST.
- Les contrats `kern-obs` et `kern-pilot` émergent des besoins réels de l'UI.
- **Authentification : obligatoire, pas optionnelle** (tranché 2026-07-28). Comptes
  individuels, accès sécurisé par collaborateur. Un `Run` devra porter son demandeur — le
  champ n'existe pas encore.
- **Identités : comptes propres à Kern d'abord** (tranché 2026-07-28). L'annuaire de
  l'entreprise (SSO/LDAP) est une piste à explorer à partir de clients de plus de cinq
  employés — donc à ne pas exclure par construction, mais à ne pas bâtir maintenant.
- **Notifications et pilotage mobile : par une messagerie existante**, pas par du push natif
  (tranché 2026-07-28). Telegram / WhatsApp / Slack selon le client. Conséquence directe : le
  critère « push fiable » qui plaidait pour une coquille native tombe.
- **`kern-orch` passe en mode démon** (tranché 2026-07-28) : un service qui tourne, plus une
  commande qu'on lance. C'est ce qui débloque la lecture des outils (C5), impossible tant que
  rien n'est vivant entre deux runs.
- **Authentification livrée** (2026-07-28) : deux identités distinctes. Un **producteur**
  présente `Authorization: Bearer` (`KERN_UI_TOKEN` ici, `KERN_SINK_TOKEN` côté kern-orch) et
  ne peut qu'écrire ; une **personne** ouvre une session par cookie et ne peut que lire.
  Aucune des deux n'ouvre les portes de l'autre. Mots de passe en PBKDF2-SHA256 (600 000
  itérations, bibliothèque standard — kern-ui reste sans dépendance). Comptes créés par
  `kern-ui useradd`, jamais à la main.
- **Le binaire REFUSE de démarrer** sur une adresse publique sans jeton ni compte. Un
  avertissement se rate ; un processus qui ne démarre pas, non.
- **TLS livré** (2026-07-28). Soit `kern-ui` sert HTTPS lui-même (`KERN_UI_TLS_CERT` /
  `KERN_UI_TLS_KEY`, TLS 1.2 minimum), soit un proxy inverse le termine et on le déclare
  (`KERN_UI_TRUST_PROXY=1`). **Le binaire refuse de servir une adresse publique en clair** :
  authentifier sans chiffrer protège d'un curieux, pas d'un réseau. `X-Forwarded-Proto` n'est
  cru que si un proxy est déclaré — n'importe quel client peut poser cet en-tête.
- Transport vers l'instance centralisée : _à décider_.

## Méthode obligatoire
- **TDD** : écrire les tests AVANT le code. Go → `go test` ; front → Vitest ; E2E avant merge.
- **SOLID/DRY** : une responsabilité par module ; on étend par composition. Un composant
  qui pilote un run, formate son état et l'affiche viole la règle : il se découpe.
  Aucune logique dupliquée entre le Go et le front, aucune donnée recopiée des deux côtés.
- **Le vocabulaire affiché est celui du client, jamais le nôtre.** `web/src/i18n/fr.ts` ne
  contient ni « run », ni « graphe », ni « topologie », ni « nœud », ni nom de brique, ni nom
  de fichier. Les mots sont fixés une fois : run → **mission**, graphe/topologie →
  **déroulé**, nœud/niveau → **étape**, frontière → **en cours**, skill → **compétence**, et
  une brique manquante se nomme par **la capacité absente** (« la mémoire des agents n'est
  pas encore branchée »), jamais par son nom de code. Ce produit se montre en démonstration :
  un écran qui dit `kern-pilot` renseigne le client sur notre découpage et sur rien de son
  travail. Un test échoue si un nom de brique réapparaît à l'écran.
- **Code et documentation en anglais** : noms, commentaires, commits, tests, `docs/`.
  Seuls les textes affichés à l'utilisateur restent en français, dans les fichiers de
  traduction, jamais en dur dans un composant.
  Une exception, assumée et unique : `docs/a-trancher.md` est en français. C'est un support
  de décision destiné à l'équipe, pas au code — le traduire lui ferait perdre son objet.
- **Git** : `main` ← `dev` ← `feature/xx`. Jamais de commit direct sur main/dev.
  Tests verts avant merge dans `dev`.
- **Index OKF** : à la fin de chaque feature, créer/mettre à jour `docs/index/<feature>.md`
  (entête YAML : id, feature, branch, status, files, tests, decisions ; corps ≤ 15 lignes).
  Lire `docs/index/` en début de session au lieu de relire tout le code.
- **Rétro continue** : noter dans `docs/index/retro.md` ce qui a fonctionné ou non.
- **Reprise de session** : lire `docs/next-steps.md` (état, décisions, suite ordonnée) et
  `docs/expected-contracts.md` (les 10 contrats attendus, leur producteur, leur état).
- Suivre le skill `greenfield-tdd-okf` pour le bootstrap et chaque feature.

## Règles métier clés
- Les maquettes de référence vivent dans `design/mockups/` (`*.dc.html`).
  Elles se lisent, ne s'éditent pas. Elles chargent React et les polices depuis un CDN :
  tout doit être bundlé localement dans l'app, qui fonctionne hors ligne.
- Source de vérité des tokens de design : un fichier unique côté front, jamais de couleur
  ni de police écrite en dur dans un composant.
- Libellés d'interface en français (Cerveau, Grimoire, Espace, Sous-agents).
- Aucune clé API ni secret dans le repo ni dans la base locale — c'est le rôle de
  `kern-vault` et `kern-link`.

## Commandes
- Dev : `make dev` (Go) + `cd web && npm run dev` (SPA, proxy vers :7777)
- Tests : `make test` · lint : `make lint` · build : `make build` · toutes cibles : `make dist`
- Alimenter en direct : `KERN_STEP_REPORT_URL=http://127.0.0.1:7777/api/v1/steps` côté kern-orch

BRAIN: ~/brain/kern-ui

## Journal d'erreurs

Quand un bug non trivial est résolu, append une ligne à `$BRAIN/bag.ndjson` :

{"trigger":"", "symptom":"", "root_cause":"", "fix":"", "severity":1, "date":"YYYY-MM-DD"}

- `trigger` : les termes techniques exacts qui identifient le contexte
  ("relation polymorphe Strapi v5"), pas une description du bug.
  C'est la clé de regroupement.
- `severity` : 1 friction · 2 rework · 3 irréversible (perte de données,
  CI verte à tort, prod)
- Append only, jamais d'édition, une ligne par incident.

Si le `trigger` n'est pas formulable en termes techniques précis, le diagnostic
n'est pas terminé : le dire plutôt que de logger une entrée floue.
Un bug résolu par hasard ne se logge pas.
Si aucune ligne `BRAIN:` n'est présente dans ce CLAUDE.md, ne rien logger et le signaler.
