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

## 2026-07-26 — live-runs (piste front)

**A fonctionné**
- Extraire la charte des maquettes (`stateMap`, ligne 369 de `Agentic OS.dc.html`) plutôt
  que de l'inventer : la sémantique d'états était déjà là, repos/réflexion/action/tension.
- Vérifier dans un vrai navigateur, pas seulement en tests : c'est ce qui a confirmé que
  les polices se chargent en local et que le flux met la page à jour sans rechargement.
- `grep` du bundle construit à la recherche de `googleapis|gstatic|unpkg` : preuve directe
  qu'aucun appel externe ne subsiste, plutôt qu'une intention.

**À surveiller**
- Le rendu mobile n'a pas pu être vérifié visuellement, `resize_window` n'a pas pris dans
  la session. À contrôler sur un vrai téléphone avant de considérer le responsive acquis.
- Les polices sont un actif binaire dans le repo (72 Ko). Si un jour une locale a besoin
  d'un autre subset, régénérer depuis l'API Google Fonts, ne pas bricoler les fichiers.

## 2026-07-26 — branchement kern-orch

**A fonctionné**
- Ouvrir un endpoint de collection (`POST /api/v1/steps`) AVANT d'écrire le reporter : le
  reporter n'a plus qu'une URL à connaître, et kern-orch reste ignorant de nos routes.
  C'est kern-ui qui absorbe le couplage, pas la brique en amont.
- Tester les modes de panne du reporter avant le chemin heureux.

**À surveiller**
- Le contrat StepEvent est maintenant dupliqué de fait : `projection.StepEvent` ici,
  `report.StepEvent` chez kern-orch. C'est volontaire — deux briques autonomes ne partagent
  pas de types — mais toute évolution doit toucher les deux côtés. Si ça devient pénible,
  c'est le signal qu'il faut un contrat publié (schéma JSON versionné), pas un package commun.
- Le reporter est synchrone chez kern-orch : un kern-ui lent ralentit les graphes, borné à
  2 s par niveau.

## 2026-07-26 — contrat exécutable

**Ce qui n'a pas fonctionné, et que Yoann a relevé**
- J'avais « sécurisé » le schéma dupliqué par un commentaire invitant à lancer un `diff`.
  Ça se sentait rigoureux sans l'être : un garde-fou qui dépend de la mémoire de celui qui
  édite ne protège de rien. Pire, il surveillait la prose alors que le vrai risque est que
  le CODE s'écarte de la prose — les deux READMEs pouvaient rester synchronisés pendant que
  `report.StepEvent` et `projection.StepEvent` divergeaient.

**La correction**
- Fixture partagée + un test de chaque côté, exécutés en CI. Le test kern-orch capture ce
  que le vrai Hook émet, pas une struct reconstruite à la main : une struct ne teste qu'elle-même.
- Vérifié en cassant volontairement le contrat. Un garde-fou qui n'a jamais échoué ne prouve rien.

**Règle à retenir**
- Un contrat entre deux briques autonomes doit être exécutable des deux côtés. Si on ne peut
  pas le tester, ce n'est pas un contrat, c'est un vœu.

## 2026-07-26 — coquille, et ce que j'avais manqué

**Ce que Yoann a relevé**
- J'avais livré une vue « Runs » et présenté la feature comme close, alors que la maquette
  contient six vues, une barre de conversation et une navigation mobile propre. Pire : la
  vue « Runs » ne figure dans aucune maquette. Je l'avais inventée parce que c'était ce que
  kern-orch savait alimenter, ce qui était défendable — mais l'annoncer comme l'interface
  ne l'était pas.
- Correction de cadrage : les serveurs MCP ne sont pas une brique, ce sont des tools/skills
  que l'agent câble à la demande. L'Espace attend donc le même contrat que le Grimoire, pas
  une brique inexistante. J'avais failli inventer une brique `kern-mcp` absente de la roadmap.

**À surveiller**
- Deux contrats manquent, et ils débloquent quatre vues à eux deux :
  1. **Topologie de graphe** dans `kern.step-event/v1` (nodes + edges au démarrage du run) →
     permet de dessiner la ruche SVG de la maquette au lieu de cartes.
  2. **Registre skills/tools** exposé par kern-orch → débloque Grimoire ET Espace.
- `Options.dc.html` contient trois directions artistiques (Grimoire Ambré, Abysse
  Bioluminescent, Obsidienne Circuit). Ambré confirmé. Les deux autres ne coûteraient qu'un
  `tokens.css` puisque aucun composant ne code de couleur en dur — la contrainte a payé.
- Cerveau, Navigateur et Rédaction attendent des briques qui n'existent pas. Ne pas les
  construire tant qu'aucune donnée réelle ne les alimente.

## 2026-07-26 — pierre de conversation

**Ce que Yoann a relevé**
- J'avais livré une barre de chat fixe en bas alors que la maquette a une pierre runique
  déplaçable, amarrable sur le côté pour se ranger. J'avais lu `onStoneMouseDown` et
  `showChat` dans le code de la maquette sans en tirer le comportement.

**Le bug que seul le navigateur a montré**
- Les handlers lisaient `dragging` depuis le state React : toute rafale de `pointermove`
  arrivant avant le re-render était perdue. Les tests unitaires passaient, la maquette
  « marchait » à la souris par chance. C'est en pilotant vraiment le navigateur que le
  déplacement s'est révélé mort. Règle : dans un handler de pointeur, l'état de drag et la
  position courante vivent dans des refs, jamais dans du state.

**À surveiller**
- La pierre est en `position:absolute` dans `.shell`. Si un jour une vue crée son propre
  contexte de positionnement, la pierre pourrait se retrouver piégée dedans.
