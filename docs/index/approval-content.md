# C13 — Contenu structuré d'approbation (dossier d'extraction)

## What

`ApprovalPanel` (`web/src/views/AgentsView.tsx`) rend maintenant un vrai comparatif quand
le state d'un run parqué sur un nœud d'approbation contient une `interpretation`
parseable — `web/src/dossiers/interpretation.ts` (`parseInterpretation`) + une nouvelle
vue `ExtractionDossierPanel` (`web/src/dossiers/ExtractionDossierPanel.tsx`) : revenus,
crédits en cours, incidents, reste à vivre, pièces manquantes, chacun avec sa source
(numéro de page) et son statut (Confirmé / À vérifier), avant Valider/Refuser. Le texte
libre existant (`state.plan_propose`, utilisé par `prospection`'s `confirm`) reste le
repli quand aucune interpretation n'est présente — rien de cassé pour les runs existants.

## Why

Suite logique de `criteres-equipe.md` : le project owner a choisi (2026-08-11) d'attaquer
C13 en premier, l'écart le plus visible entre `avel-admin.dc.html` et l'app réelle —
`ApprovalPanel` n'affichait qu'un texte libre générique là où le mockup montre un vrai
comparatif de contenu métier.

## Décision prise : pas de skill banques, le dossier d'extraction déjà réel

Le mockup montre littéralement une sélection de 3 banques avec taux/quotité
(`avel-admin.dc.html`, `.approval`/`.bank-row`). Vérifié avant de coder : ce scénario
précis n'a pas de source réelle aujourd'hui — `courtage-banques` est un skill lecture
seule (Q&A conversationnel), sans nœud d'approbation, et sa base de critères bancaires est
vide en production (`skills/courtage-banques/SKILL.md`, "Reste à faire"). Le construire
littéralement aurait exigé soit d'inventer des taux, soit d'écrire un nouveau skill de
scoring bancaire avant même d'avoir de vrais critères à interroger — décidé avec
l'utilisateur (AskUserQuestion, 2026-08-11) de ne pas le faire maintenant.

À la place : `courtage-extraction`'s nœud `confirm_extraction` a, dès aujourd'hui, une
vraie donnée structurée en state — `state["interpretation"]`, le dossier extrait et
dé-tokenisé (revenus/credits_en_cours/incidents/reste_a_vivre/pieces_manquantes, chaque
ligne avec `document_source` et `statut`). Le code Kern-Orch (`internal/cmd/
courtage_anon.go`, commentaire sur `deanonymizePII`) l'avait même explicitement laissée
sans `display:` — "meant to be reviewed at confirm_extraction through its own approval
context" — en attendant que kern-ui construise ce rendu. **Zéro changement côté
Kern-Orch** : uniquement du rendu kern-ui sur une donnée qui existait déjà.

Le mécanisme (détection d'un contenu structuré parseable, rendu dédié, repli texte sinon)
est générique — un futur skill de sélection bancaire n'aura qu'à écrire dans state une clé
que kern-ui sait reconnaître de la même manière, sans nouveau contrat de state à inventer
depuis zéro pour chaque nouveau type d'approbation. Le choix précis de cette clé pour un
futur contenu (ex. `plan_options`) reste ouvert — non tranché ici, cf. `docs/
expected-contracts.md`.

## Vérifié en réel

`interpretation.test.ts` (parseInterpretation : JSON réel, chaînes non-JSON, champs
manquants/malformés — jamais de throw), `ExtractionDossierPanel.test.tsx` (chaque section
rendue, badges Confirmé/À vérifier distincts, sections vides masquées), `AgentsView.test.tsx`
(le panneau structuré prend le pas sur `plan_propose` quand `interpretation` est présent).
306 tests front verts (était 298), `tsc -b` propre.

**Vérification bout-en-bout sur le vrai chemin réseau**, pas seulement des tests
unitaires : un vrai `kern-ui` reconstruit, démarré avec un `KERN_UI_TOKEN` réel, a reçu un
vrai `POST /api/v1/steps` — exactement le payload `kern.step-event/v1` que `Kern-Orch`'s
`report.HTTPReporter` enverrait, avec un `state.interpretation` au format JSON réel de
`courtage-extraction` — puis affiché dans un vrai navigateur : dossier AF-2288 visible
dans Dossiers, ouvert dans Suivi agent, panneau d'approbation affichant revenus/crédits/
reste à vivre/pièces manquantes avec badges et sources, boutons Valider/Refuser toujours
présents en dessous. Seule la partie non réellement exécutée est l'OCR + l'appel Claude de
`courtage-extraction` lui-même (coûteux, non nécessaire pour vérifier le rendu) — le
payload envoyé respecte exactement le contrat que ce pipeline réel produit.

## Left open, on purpose

- `confirm_memo` (le second nœud d'approbation de `courtage-extraction`, sur
  `state.memo_draft`, un texte prose) n'a pas été retouché — hors scope de cette passe,
  qui ciblait `confirm_extraction`. Le texte libre y reste tel quel, non régressé.
- C14 (journal narratif) et C6 (canal de pilotage) restent les deux chantiers suivants,
  non commencés.
