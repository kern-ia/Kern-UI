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

## 2026-07-26 — ruche et contrat v2

**A fonctionné**
- Écrire le layout et les statuts comme fonctions pures avant de dessiner : neuf tests
  couvrent l'arrangement, le composant SVG n'est plus qu'un rendu.
- Se demander « qu'est-ce qui doit VRAIMENT traverser le contrat ? ». Le statut par nœud
  semblait en avoir besoin ; en fait la projection le dérive des frontières qu'elle voit
  déjà passer. Seul l'échec devait voyager. Un contrat plus petit que prévu.
- Rejouer volontairement la panne de contrat sur v2 pour vérifier que le garde-fou mord.

**Ce que j'ai raté deux fois**
- Lancer les tests kern-ui depuis le répertoire de kern-orch : `FAIL [setup failed]`, qu'on
  peut prendre pour un vrai échec. Deuxième occurrence dans cette session. Toujours vérifier
  le répertoire courant avant de conclure quoi que ce soit d'un résultat de test.

**À surveiller**
- Un nœud `subgraph` est dessiné comme un nœud simple. Imbriquer la ruche de l'enfant
  demanderait sa topologie, que rien n'envoie.
- L'échec ne nomme pas le nœud fautif. On marque toute la frontière active ; si un jour le
  message devient structuré, on pourra être précis.

## 2026-07-27 — skills-registry (C4)

**A fonctionné**
- Poser la question du transport AVANT d'écrire : kern-orch est un CLI, pas un démon. Le
  pull aurait exigé de lui monter un serveur. Trente secondes de lecture de `http.go`
  (« l'URL est tout le contrat ») ont tranché push + seconde variable d'env.
- Écrire la logique pure (`grimoire.ts`) avant le composant : les 14 premiers tests ont
  tenu la vue entière ensuite, et `activityOf` a pu réutiliser `nodeStatus` de la ruche au
  lieu de recalculer un état concurrent.
- Vérifier dans un vrai navigateur AVEC un run réellement lent. Un stub instantané aurait
  montré « Repos » partout et laissé croire que ça marchait.
- Les cas de refus écrits en table (`TestReplaceRejectsWhatTheInterfaceCannotDraw`) avec un
  champ `why` : le message d'échec explique la règle, pas seulement qu'elle a sauté.

**À surveiller**
- **Un identifiant qui ressemble à un autre n'est pas le même.** Le statut des sous-agents
  a failli se dériver de l'id du nœud, qui n'est pas le nom du skill (`greet` exécute
  `planner`). Ça aurait été faux partout, et faux en silence. Quand deux domaines doivent
  se rejoindre, exiger le lien explicite plutôt que la ressemblance de nommage.
- **Une fiche de contrat écrite depuis une maquette est plus large que le contrat réel.**
  C3 avait rétréci ; C4 aussi (`wired`, id, `dir` supprimés) et n'a débloqué qu'une vue au
  lieu de deux. Traiter `expected-contracts.md` comme un besoin à instruire, pas un schéma
  à implémenter.
- `StepFunc` ne fire qu'à la fin d'un niveau : rien n'est visible pendant le premier. Pour
  toute vérification E2E d'un état « en cours », attendre la SECONDE frontière.
- Une fixture partagée assertée depuis deux fichiers de test dans le même paquet
  (`contract_test.go` et `v2_test.go` côté kern-orch) : patcher l'un laisse l'autre rouge.

## 2026-07-27 — activity-signal (C10)

**A fonctionné**
- Lire le code avant de croire la fiche : la moitié de C10 (`Tension`) n'attendait aucun
  contrat, seulement un commentaire périmé depuis C3. Vérifier ce qui est *déjà* dérivable
  avant d'ouvrir un contrat, systématiquement.
- Reporter hors du fil du run pour l'activité, avec `Flush()` avant sortie de commande.
  Le signal qui éteint le phare est le dernier d'un run, donc exactement celui qu'un
  processus qui sort laisse tomber : « fire-and-forget » sans flush = « fire-and-lose ».
- Ouvrir le bracket au spawn plutôt qu'au premier token : un provider qui répond d'un bloc
  ne streame rien, et attendre un token l'aurait affiché comme n'ayant jamais réfléchi.
- Le test de bout en bout dans `internal/cmd` (hook runner → relay → reporter → sink) :
  les tests unitaires couvraient chaque maillon, aucun ne couvrait la chaîne.

**À surveiller**
- **Un état permanent affiché avec un libellé au présent est un mensonge.** `Bloqué` et
  `Tension` restaient allumés pour toujours après un échec. Règle retenue, la même partout :
  un échec compte tant qu'il est le *dernier mot* sur la chose concernée.
- Un nouveau chemin d'entrée crée des états intermédiaires inédits : le run devient visible
  avant sa topologie, et « n'a pas déclaré sa topologie » se lisait comme définitif. Quand
  on avance le moment où une donnée apparaît, relire tous les messages qui parlent de son
  absence.
- `cat >> fichier <<'EOF'` avec un corps vide **crée** le fichier : un fichier de test vide
  fait échouer vitest (« no tests »). Vérifier `git status` après.
- Lancer `npx vitest` depuis la racine et non depuis `web/` charge la mauvaise config
  (`it is not defined`). Passer par `make test`.

**Butée structurelle notée**
- C5 n'est pas bloqué par un schéma mais par un processus : kern-orch est un CLI, donc entre
  deux runs rien n'est vivant pour rafraîchir une valeur de widget. Prérequis = EPIC-03
  (exposition des tools par un service). Consigné dans `expected-contracts.md`.

## 2026-07-28 — failing-node

**A fonctionné**
- Chercher la donnée AVANT de concevoir un contrat. Troisième fois de suite que l'information
  existait déjà chez le producteur et se perdait en route (`skill`, puis l'id du nœud en
  échec). Réflexe à garder : `grep` dans le producteur avant d'écrire un champ.
- Rendre le pluriel obligatoire par le raisonnement : au singulier, la garantie « non nommé
  donc réussi » devient fausse dès que deux nœuds cassent. Le contrat est plus juste parce
  qu'on a cherché ce qui le rendrait faux.
- `LevelError.Error()` renvoie exactement l'ancien message : aucun test existant n'a bougé
  alors que le type de l'erreur a changé.

**À surveiller**
- Un E2E d'échec demande un échec à l'EXÉCUTION, pas au chargement : un `func` inexistant
  est rejeté par le loader avant que le graphe ne tourne. Il a fallu un faux CLI qui échoue
  selon le `node_id` reçu sur stdin.
- Le moteur renvoyait la PREMIÈRE erreur du niveau et jetait les autres, alors que `wg.Wait()`
  les avait toutes. Collecter avant de renvoyer ne coûte rien et évite de perdre ce qu'on a.

## 2026-07-28 — rapporteur asynchrone (côté kern-orch)

**À retenir ici, même si le code est dans l'autre repo**
- Le contrat d'ingestion promettait « best-effort » côté producteur ; il ne disait pas que
  le producteur ne devait pas non plus RALENTIR pour nous. C'est écrit maintenant.
- L'ordre des steps est une garantie dont dépend la projection (`ev.Step <= run.Step` rejette
  un niveau périmé). Si un jour un producteur livre en parallèle, la projection perdra des
  frontières sans rien signaler. Le README le dit désormais explicitement.

## 2026-07-28 — nested-runs

**A fonctionné**
- Se demander ce que l'option la moins chère afficherait *vraiment* : envoyer la forme de
  l'enfant sans son état aurait produit une ruche grise sous un nœud terminé. Un dessin qui
  n'apprend rien et laisse croire le contraire est pire que l'absence de dessin.
- Réutiliser `HiveGraph` récursivement plutôt que d'inventer un visuel imbriqué : la maquette
  ne montre pas ce cas, et le même composant garde le langage visuel qu'elle a fixé.

**À surveiller**
- `vitest` annonce « 98 passed » quand des fichiers ne compilent pas : les tests disparus ne
  sont pas comptés comme échoués. Toujours lire la ligne **Test Files**, pas seulement Tests.
- Deux glyphes de la maquette ne sont pas dans les polices embarquées (`▸`, `▾`). Vérifier à
  l'écran tout caractère décoratif, les tests ne voient pas une police manquante.

## 2026-07-28 — jalon v0.1.0

**Ce que la session a donné**
Cinq features livrées en un jour — registre des skills, signal d'activité, nœud en échec,
rapporteur asynchrone, runs imbriqués — plus les décisions produit tranchées et consignées.
De 58 à 117 tests front, de 3 à 4 paquets Go.

**Le motif le plus utile de la session**
Trois fois sur cinq, la donnée nécessaire existait déjà chez le producteur et se perdait en
route : la référence `skill` d'un nœud, l'id du nœud en échec, les niveaux d'un sous-graphe.
Aucune ne demandait un nouveau calcul, seulement d'arrêter de la jeter. **Réflexe à garder :
avant d'écrire un champ de contrat, chercher s'il n'est pas déjà connu quelque part.**

**Le second motif**
Une fiche de contrat écrite depuis une maquette est plus large que le contrat réel. C3 a
rétréci, C4 a rétréci et n'a débloqué qu'une vue au lieu de deux, C10 s'est révélé à moitié
déjà faisable. Instruire le besoin, ne pas implémenter le schéma.

**Ce qui a le mieux payé en méthode**
Mesurer plutôt que déduire. Le rapporteur asynchrone semblait fini ; la mesure a montré que
l'attente avait seulement migré du moteur vers la sortie du processus.

## 2026-07-28 — vocabulaire de démonstration

**A fonctionné**
- La centralisation du texte dans `fr.ts` a payé : la reprise complète du vocabulaire a tenu
  dans un fichier plus un modèle. Une convention qui coûte peu et rapporte d'un coup.
- Faire entrer le vocabulaire client dans le TYPE (`capability` au lieu de `brick`) plutôt
  que seulement dans les libellés. Un libellé se corrige, un modèle empêche la rechute.

**À surveiller**
- Le retour est venu de l'usage prévu — « je dois montrer ça en démo » — pas d'une revue de
  code. Aucun test ne voyait le problème puisque tous comparaient à `fr.*`, donc à eux-mêmes.
  **Un test qui compare l'affichage à sa propre source de vérité ne valide pas le contenu.**
  D'où le test de garde qui interdit un motif (`kern-*`) plutôt que d'affirmer une égalité.
- L'honnêteté et la lisibilité ne s'opposaient pas : dire « la mémoire n'est pas branchée »
  est aussi vrai que « attend kern-memory », et compréhensible. Quand les deux semblent
  s'opposer, c'est souvent qu'on n'a pas cherché la bonne formulation.

## 2026-07-28 — authentification de l'API

**A fonctionné**
- Chercher dans la bibliothèque standard avant d'ajouter une dépendance : `crypto/pbkdf2`
  est entré en Go 1.24. kern-ui garde zéro dépendance, ce qui est la raison pour laquelle
  cinq cibles se compilent en une commande.
- Faire échouer le DÉMARRAGE plutôt qu'avertir. Un avertissement dans un journal se rate le
  premier jour chargé ; une API ouverte ne s'annonce pas.
- Écrire les tests de refus avant les tests d'acceptation : c'est en listant les endpoints à
  protéger qu'apparaît celui qu'on allait oublier.

**À surveiller**
- Un jeton non configuré doit refuser TOUT, pas tout accepter. C'est le cas le plus probable
  d'un mauvais déploiement, et le plus facile à écrire à l'envers.
- Le temps de réponse d'une page de connexion est une information : sans haché leurre, un
  compte inconnu répond plus vite et la page devient un annuaire du personnel.
- L'authentification sans TLS ne protège que d'un curieux, pas d'un réseau. Livrer l'une en
  laissant croire que l'autre est faite serait pire que de n'avoir rien livré.

## 2026-07-28 — TLS

**A fonctionné**
- Reprendre le raisonnement de la veille plutôt qu'en inventer un autre : « un avertissement
  se rate » valait pour les identifiants manquants, il vaut pour le clair. Cohérence obtenue
  en réutilisant l'argument, pas en le redécouvrant.
- Nommer les trois issues dans le message de refus. Un refus sans issue se contourne par la
  première variable d'environnement trouvée sur un forum.

**À surveiller**
- **Un drapeau de sécurité qui dépend de la connexion locale est faux derrière un proxy.**
  `r.TLS` est nul alors que le navigateur a bien utilisé https : le cookie partait sans
  `Secure`. Le défaut datait de la veille et aucun test ne le voyait, parce que tous les
  tests parlent directement au routeur — jamais à travers un intermédiaire.
- Croire un en-tête `X-Forwarded-*` par défaut, c'est laisser l'appelant décider qu'il est
  en sécurité. Toujours conditionner à une déclaration explicite d'exploitation.

## 2026-07-28 — rendu mobile

**Le constat qui compte**
132 tests au vert et une interface **inutilisable sur téléphone** : la navigation était
masquée par la pierre de conversation. Aucun test ne pouvait le voir — ils rendent des
composants dans un DOM sans dimensions, où aucune media query ne s'applique et où rien ne se
superpose. **Une suite verte ne dit rien de la mise en page.**

**A fonctionné**
- Contourner l'outil défaillant plutôt que de reporter encore : `resize_window` ne marche pas,
  mais trois `<iframe>` aux largeurs d'appareils déclenchent les vraies media queries et
  montrent trois tailles côte à côte.
- Corriger un défaut en a révélé un autre : réserver la bande du bas a fait disparaître la
  pierre, parce qu'une position mémorisée n'était pas recadrée. Regarder l'écran APRÈS chaque
  correction, pas seulement après la dernière.

**À surveiller**
- Un point de rupture dupliqué entre CSS et JS finit toujours par diverger. Le mettre dans une
  variable CSS et le lire depuis le JS garde une seule source.
- Une contrainte écrite dans CLAUDE.md et jamais vérifiée reste fausse pendant des mois. Celle
  du responsive datait du premier jour.

## 2026-07-29/30 — C6 (proxy kern-ui : stop/nudge/decide/dispatch)

**A fonctionné**
- Même forme que C5 (`internal/tools` → `internal/steer`) : client typé, `Enabled()`,
  erreurs typées (`InvalidInputError`, `UnknownSkillError`) plutôt que des chaînes à
  parser. La deuxième fois qu'un patron se répète, l'écrire devient un copier-coller
  informé plutôt qu'une nouvelle conception.
- L'acteur ne vient JAMAIS du corps de la requête côté kern-ui : lu depuis la session
  (`s.currentUser(r)`), jamais depuis ce que le navigateur prétend. kern-orch, lui, fait
  confiance à l'acteur transmis — deux niveaux de confiance différents, documentés comme
  tels plutôt que mélangés.

**Le bug que seul le vrai kern-orch + le vrai kern-ui a montré**
- `requester` sur un run dispatché n'atteignait jamais la projection de kern-ui : le champ
  existait bien côté `report.StepEvent`… sauf qu'il n'avait en fait jamais été ajouté —
  écart entre le plan et le code, découvert seulement en lisant les logs kern-orch
  (« sink answered 400 Bad Request »).
- Une fois corrigé, un DEUXIÈME bug est apparu derrière : kern-ui rejetait purement et
  simplement l'événement `steer.yaml` avec `kind: approval` — `validKinds` côté
  `projection.go` ne connaissait que `tool|agent|subgraph`. Le nouveau type de nœud du
  moteur kern-orch (C6) n'avait jamais été répercuté sur la liste kern-ui qui valide la
  topologie reçue. Aucun test unitaire des deux côtés ne pouvait le voir : chacun testait
  contre sa propre idée du contrat, pas contre l'autre application réelle.

**Règle à retenir**
- Un nouveau `Kind`/type de nœud côté kern-orch est un CHANGEMENT DE CONTRAT, pas un détail
  interne au moteur — toute liste de kinds valides côté consommateur (ici
  `projection.validKinds`) doit être mise à jour dans la MÊME feature, pas découverte à
  l'usage. Chercher `validKinds`/équivalent chez le consommateur dès qu'un `Kind` nouveau
  apparaît côté producteur.
