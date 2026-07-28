# À trancher

Les décisions qui attendent une réponse humaine, expliquées sans jargon.

> **Pourquoi ce document existe.** `expected-contracts.md` dit la même chose en langage
> technique, pour ceux qui écrivent le code. Celui-ci s'adresse à ceux qui décident. Les deux
> restent d'accord : quand une décision est prise ici, elle est reportée là-bas.
>
> _Exception assumée aux conventions du repo : tout ce qui vit dans `docs/` est en anglais.
> Ce fichier est en français parce qu'il sert à une discussion, pas à du code._

Écrit le 2026-07-28, mis à jour le même jour après le brainstorming
(`brainstorming_28_07_2026.html`), qui répond à cinq des sept décisions.

## Ce qu'il faut savoir avant de lire

Kern est découpé en briques indépendantes. Deux sont construites et se parlent aujourd'hui :

- **kern-orch** — le chef d'orchestre. Il exécute des enchaînements d'agents. C'est un
  programme en ligne de commande : il démarre, fait son travail, et s'arrête. Ce détail
  revient dans la décision 5.
- **kern-ui** — l'interface. Elle affiche ce que font les agents. C'est la brique dont il
  est question dans ce dossier.

Deux autres existent déjà et restent à raccorder (**kern-link**, la passerelle vers les
modèles d'IA, et **kern-anon**). Les dernières — mémoire, pilotage, confinement, politiques —
sont nommées mais pas construites.

**Ce qui marche aujourd'hui** : on voit les agents travailler en direct, sous forme de
graphe. On voit le catalogue des compétences et des sous-agents disponibles. Le voyant d'état
en haut à droite dit si le système se repose, réfléchit, agit, ou est en difficulté.

**Ce qui ne marche pas** : on ne peut rien piloter. Aucun bouton n'agit. La conversation est
inerte. **Quatre vues sur six** affichent ce qu'elles attendent — la brique ou la donnée
manquante, nommée — plutôt que d'inventer du contenu. C'est délibéré : un écran qui a l'air
rempli apprend quelque chose de faux sur l'état réel du système.

---

## Les décisions et leurs réponses

| # | Décision | État | Réponse |
|---|---|---|---|
| 1 | Le confinement des agents | ✅ tranché | Bac à sable ; l'orchestrateur garde le contrôle à l'extérieur |
| 2 | Plusieurs utilisateurs, ou un seul ? | ✅ tranché | **Plusieurs** — usage entreprise, simultanés |
| 3 | Protéger l'accès à l'interface | ✅ tranché | Authentification obligatoire, comptes individuels |
| 4 | Qui crée les sous-agents ? | ✅ reporté | Hors POC ; la question de fond reste entière |
| 5 | Les outils en permanence ? | ✅ tranché | **Oui** — l'orchestrateur passe en démon |
| 6 | Le mobile | ✅ tranché | **Par une messagerie existante** — Telegram / WhatsApp / Slack |
| 7 | Poser un jalon stable | ⬜ **non abordé** | — |

Une huitième chose est ressortie du brainstorming sans figurer dans cette liste : **le
contrôle à distance** — stopper un agent, valider ou refuser une de ses décisions, déclencher
une action simple. Ce n'est pas une question ouverte mais du périmètre confirmé : c'est le
contrat C6, porté par `kern-pilot`.

**Attention en lisant la suite** : les sections ci-dessous ont été écrites *avant* les
réponses. Chacune porte maintenant un encadré « Réponse » en tête. Le corps est conservé —
il dit pourquoi la question se posait, ce qui reste utile pour la mettre en œuvre.

---

## 1. Le confinement des agents

> **✅ Réponse (2026-07-28) — bac à sable.** L'agent garde sa liberté d'action *dans son
> périmètre* ; l'orchestrateur garde le contrôle à l'extérieur. C'est l'option « sérieux »
> ci-dessous, pas le minimum : la brique `kern-exec`, avec `kern-guard` et `kern-policy`.
> Reste à cadrer l'étendue du bac (système de fichiers, réseau, budgets) — c'est de la
> conception, plus un arbitrage.


**Ce dont il s'agit.** Quand un agent travaille, kern-orch lance le programme d'IA comme un
sous-programme de votre machine. Ce sous-programme hérite de **tous vos droits** : il peut
lire et écrire n'importe quel fichier auquel vous avez accès, lancer n'importe quelle
commande, et sortir sur Internet. Rien ne l'en empêche.

**Pourquoi c'est urgent.** Ce n'est pas un manque de fonctionnalité, c'est un trou ouvert
maintenant. Il ne dépend d'aucune autre décision de cette liste, et il existe quelle que soit
la suite qu'on donne au reste.

**Ce qui est à trancher, en réalité, ce n'est pas *si* mais *jusqu'où*** :

- **Minimum** — limiter le dossier et le réseau accessibles. Rapide.
- **Sérieux** — un vrai bac à sable au niveau du système, plus des budgets (temps, argent,
  ressources) et une escalade quand un agent veut dépasser. C'est la brique `kern-exec`, avec
  `kern-guard` et `kern-policy` à côté.

**Ce que je recommande.** Traiter au moins le minimum tout de suite, sans attendre que le
reste soit décidé. C'est aussi le seul chantier de la liste où le langage Rust est clairement
le bon outil — pour des raisons techniques précises documentées ailleurs, pas par goût.

---

## 2. Plusieurs utilisateurs, ou un seul ?

> **✅ Réponse (2026-07-28) — plusieurs.** Usage entreprise, plusieurs collaborateurs
> simultanés. La ligne de `CLAUDE.md` qui disait le contraire est corrigée.
>
> Les cinq conséquences listées plus bas ne sont donc plus des hypothèses. La plus urgente
> parce qu'elle est structurelle : **une tâche doit porter qui l'a demandée**, et ce champ
> n'existe nulle part. Plus on enregistre de tâches sans lui, plus il coûte cher.


**Ce dont il s'agit.** Aujourd'hui l'hypothèse écrite est : « usage interne Kern, pas de
produit multi-comptes ». Une seule personne, sa machine, ses agents.

**La question qui change tout** : est-ce qu'un agent peut recevoir des demandes de
**plusieurs personnes** ?

**Pourquoi c'est la décision la plus structurante.** Si la réponse est oui, cinq choses
changent, et aucune ne se rattrape facilement après coup :

- chaque tâche doit savoir **qui l'a demandée** — cette information n'existe nulle part
  aujourd'hui ;
- il faut une file d'attente par agent, et un arbitrage quand deux personnes demandent en
  même temps ;
- il faut décider **qui a le droit d'interrompre le travail de qui** ;
- l'authentification cesse d'être optionnelle (voir décision 3) ;
- la conversation devient personnelle au lieu d'être commune.

**Ce que ça coûte de décider tard.** Ajouter « qui a demandé ça » à un système qui a déjà
enregistré des milliers de tâches sans cette information, c'est réécrire l'historique ou
l'abandonner. Ajouter la même chose avant d'avoir écrit le pilotage, c'est un champ de plus.

**Ce que je recommande.** Répondre avant d'écrire le pilotage des agents, quelle que soit la
réponse. C'est une décision produit — qui utilise l'outil — pas une décision technique.

---

## 3. Protéger l'accès à l'interface

> **✅ Réponse (2026-07-28) — authentification obligatoire**, comptes individuels, accès
> sécurisé par collaborateur. Elle découle de la 2 et n'est plus optionnelle.
>
> **La source des identités est tranchée** : comptes propres à Kern pour commencer.
> L'annuaire de l'entreprise (SSO/LDAP) devient intéressant à partir de clients de plus de
> cinq employés — donc une porte à laisser ouverte dans la conception, pas une chose à
> construire maintenant.


**Ce dont il s'agit.** L'interface est un serveur. Par défaut elle n'écoute que la machine
locale, et dans ce cas il n'y a pas de problème. Mais elle peut être ouverte au réseau en
changeant un réglage — c'est vérifié, ça fonctionne.

**Le problème.** Une fois ouverte, **il n'y a aucun mot de passe**. Toute personne qui peut
atteindre la machine peut lire tout ce que font les agents, et peut aussi **injecter de
faux événements** — faire apparaître des tâches qui n'ont jamais eu lieu.

**Ce qui est à trancher.**

- **Qui doit pouvoir se connecter ?** Vous seul depuis vos machines, l'équipe, ou une
  instance centralisée accessible de l'extérieur ?
- **Quel niveau ?** Un secret partagé suffit entre machines de confiance. Des comptes
  individuels deviennent obligatoires si la décision 2 dit « plusieurs utilisateurs ».

**Ce que je recommande.** Tant que ça tourne sur une seule machine, ne rien faire est
défendable. Le jour où quelqu'un d'autre l'ouvre — même sur le réseau du bureau — ça devient
la première chose à régler. **Cette décision découle de la 2 : tranchez la 2 d'abord.**

---

## 4. Qui crée les sous-agents, et où vivent-ils ?

> **✅ Réponse (2026-07-28) — reporté, et sa forme future a changé.**
>
> Trois choses ont été dites. La création est **hors de la version mobile**. Elle est
> **réservée à l'équipe Kern dans un premier temps** — donc pas de création par le client, ce
> qui retire pour l'instant toute la question du multi-utilisateur appliquée aux
> sous-agents. Et à terme, la direction visée n'est plus « écrire un skill » mais **un
> éditeur no-code** : des nœuds simples que le client relie, un n8n ultra-simplifié, dans
> l'esprit de Scratch.
>
> **Cette troisième partie change ce que sera le contrat**, pas seulement sa date — voir
> ci-dessous. Le `+` du Grimoire reste affiché et désactivé, désormais parce que c'est décidé.


**Ce dont il s'agit.** Dans la maquette, le Grimoire a un bouton « Nouveau sous-agent ». Il
est affiché mais désactivé, parce que rien dans le système ne sait créer quoi que ce soit.

**L'état réel, qui surprend souvent.** Un « sous-agent » n'est pas un objet à part. C'est une
compétence dont la fiche descriptive porte la mention `agent` au lieu de `outil`. Un seul mot
de différence — et les deux colonnes du Grimoire, c'est littéralement ce mot.

Ces fiches sont **des fichiers dans un dossier**. Pas une base de données : pas d'index, pas
d'historique, et surtout **aucune écriture**. Le système lit ce dossier et ne le modifie
jamais. Il n'y a pas non plus de distinction entre compétences « du système » et compétences
« ajoutées » : un seul dossier, à plat.

**Trois questions imbriquées.**

**a) Un étage ou deux ?** Faut-il séparer les compétences livrées avec le produit de celles
que quelqu'un crée ? Un seul dossier est plus simple — au risque qu'une mise à jour écrase
une création. Deux étages veulent dire que l'interface sait ce qu'elle a le droit de
supprimer.

**b) Qui écrit ?** Trois candidats : le chef d'orchestre (il détient le dossier), la brique
de pilotage (elle détient le chemin de création), ou la mémoire (un sous-agent créé est une
forme de savoir accumulé).
_Ma recommandation :_ le pilotage commande, le chef d'orchestre écrit. **Celui qui lit un
dossier doit être celui qui l'écrit**, sinon deux briques se disputent les mêmes fichiers et
personne n'est responsable du résultat.

**c) Et si plusieurs personnes créent ?** Un sous-agent créé par qui, visible par qui,
supprimable par qui. **Cette question est la décision 2.** La trancher après coup veut dire
construire un stockage sans notion de propriétaire, et devoir l'ajouter plus tard.

**Ce que ça bloque.** Uniquement le bouton de création. Tout le reste de l'interface avance
sans.

### La piste no-code, et pourquoi elle est plus proche qu'elle n'en a l'air

L'intention : que n'importe qui puisse prototyper un agent en reliant des nœuds, sans écrire
de fichier.

**Le format existe déjà.** `kern-orch` ne sait pas exécuter autre chose qu'un graphe déclaré :
des nœuds typés (`tool`, `agent`, `subgraph`), des arêtes, et du routage conditionnel. Un
éditeur visuel n'aurait donc **aucun format à inventer** — il produirait exactement ce que le
moteur charge déjà. C'est une différence énorme avec le cas habituel où l'éditeur no-code
oblige à créer une couche de traduction.

Conséquences, si cette piste se confirme :

- **C'est une fonctionnalité de l'interface, pas une brique.** Elle produit un fichier de
  graphe ; c'est déjà ce que le Grimoire et la vue Agents savent lire et dessiner.
- **La question 4b — qui écrit — se pose autrement.** Il ne s'agit plus d'écrire une fiche de
  compétence dans un dossier, mais d'enregistrer un graphe. Ce n'est pas la même écriture, ni
  forcément le même propriétaire.
- **La vue Agents dessine déjà des graphes.** L'éditeur et le moniteur montrent la même
  chose ; les faire diverger visuellement serait un choix, pas une fatalité.
- **Le plus dur n'est pas le glisser-déposer**, c'est la palette : quels nœuds un non-technicien
  peut relier sans se tromper. Scratch marche parce que les blocs ne s'emboîtent que d'une
  manière valable. C'est une question de conception de produit, à instruire avant le code.

Rien de tout cela n'est à construire maintenant. C'est noté pour que la question 4, le jour
où elle revient, ne soit pas rouverte sur la mauvaise prémisse.

---

## 5. Les outils doivent-ils tourner en permanence ?

> **✅ Réponse (2026-07-28) — oui : l'orchestrateur passe en mode démon.** Un service qui
> tourne en tâche de fond, plus une commande qu'on lance et qui s'arrête.
>
> C'est la première des trois options ci-dessous. Elle débloque la vue Espace, et elle change
> bien plus que ça : c'est aussi ce qui rend possible l'instance centralisée, le contrôle à
> distance et les notifications. Gros chantier, chez `kern-orch`.


**Ce dont il s'agit.** La vue **Espace** de la maquette montre des cartes : « Pull requests
ouvertes : 4 », « Messages non lus : 12 », « Prochain rendez-vous : 14:30 ». Chaque carte
affiche une mesure vivante prise dans un outil connecté.

**Le blocage, qui n'est pas celui qu'on croit.** L'interface sait déjà **quels** outils
existent — c'est réglé. Ce qui manque, c'est la **valeur**. Et le problème n'est pas de se
mettre d'accord sur un format : c'est que **rien n'est allumé pour aller la chercher**.

Une valeur comme « messages non lus » change toute la journée, indépendamment du travail des
agents. Or le chef d'orchestre est un programme en ligne de commande : entre deux tâches,
**aucun processus ne tourne**. Il n'y a personne à qui demander, et personne pour envoyer.

**Les options.**

- **Rendre les outils accessibles en permanence.** Un service qui tourne et répond quand on
  l'interroge. C'est déjà prévu dans la feuille de route de kern-orch, et c'est un gros
  chantier. Ça change la nature du chef d'orchestre : d'un programme qu'on lance à un service
  qui tourne.
- **Assumer des valeurs périmées.** Les cartes ne se mettent à jour que quand une tâche
  tourne, avec l'âge affiché : « 12 — il y a 3 h ». Pas de nouveau chantier, honnête sur ce
  qu'on montre. Mais « messages non lus il y a 3 heures » n'aide pas beaucoup, et il faudra
  refaire la vue le jour du vrai service.
- **Faire lire les outils par l'interface elle-même.** Le plus rapide. **Je le déconseille** :
  l'interface apprendrait à manipuler des outils, ce qui n'est pas son métier, et perdrait
  l'indépendance entre briques qui est le principe de toute l'architecture.

**Ce que je recommande.** Ne pas construire la vue avant d'avoir choisi. Une grille de cartes
écrite pour des valeurs périmées se redécoupe entièrement le jour du vrai service.

---

## 6. Le mobile — et la messagerie comme surface de pilotage

> **✅ Réponse (2026-07-28) — on ne construit pas de canal mobile, on en emprunte un.** Le
> téléphone doit réagir, mais les notifications et le pilotage passent par une messagerie que
> le client utilise déjà : Telegram, WhatsApp, Slack selon les cas.

**Pourquoi c'est plus qu'un choix technique.** Trois choses tombent d'un coup :

- **Le critère qui plaidait pour une coquille native disparaît.** La question était « un push
  fiable justifie-t-il une application installée ». Si la notification est un message
  Telegram, la question ne se pose plus.
- **On ne gère plus de communication chiffrée** ni de jetons de push, ni de présence dans les
  stores. C'est sous-traité à des gens dont c'est le métier.
- **On rencontre l'utilisateur là où il est.** Une PME ne connaît pas forcément Slack ; elle a
  déjà WhatsApp sur tous les téléphones. Aucune installation à demander.

**Ce que ça ouvre, et qui va plus loin que la notification.** Si l'on peut *tout piloter* par
le chat — arrêter un agent, valider ou refuser, lancer une action — alors le chat n'est plus
une sortie, c'est une seconde surface de commande à côté de l'interface. Le même contrat les
sert : c'est C6, `kern-pilot`.

### Ce qui reste à trancher là-dessus

**a) Quelle messagerie en premier ?** Elles ne coûtent pas la même chose à livrer :

| | Ce qu'il faut | Coût |
|---|---|---|
| **Telegram** | Un bot, un jeton. Rien d'autre. | Gratuit, livrable en une journée |
| **Slack** | Une app installée par espace de travail | Modéré ; suppose que le client connaît Slack |
| **WhatsApp** | API Business, compte Meta vérifié, messages *template* validés pour tout message que l'on initie | Le plus cher et le plus lent des trois, facturé à la conversation |

Ironie à assumer : **la messagerie que les PME ont déjà est la plus difficile à livrer**.
Telegram est le bon premier pas — il prouve la boucle complète en une journée — mais il ne
prouve pas que WhatsApp suivra sans travail.

**b) Le chat devient une surface d'autorisation.** C'est le point que je soulève et qui n'a
pas été discuté. Si un message peut arrêter un agent ou valider une décision, alors quiconque
écrit au bot peut le faire. Il faut donc lier un compte de messagerie à un compte Kern, et ce
lien porte les mêmes conséquences que l'authentification de l'interface. Trois questions
concrètes : comment on associe les deux la première fois, ce qui se passe si quelqu'un change
de numéro, et si une validation critique peut se faire par chat ou seulement dans
l'interface.

**c) Où passent les données, et sous quel régime.** Faire transiter le travail d'une
entreprise par les serveurs de Meta ou de Telegram est une question de traitement de données
avant d'être une question technique. **Je ne suis pas en mesure de valider la conformité de
l'un ou de l'autre**, et je note que la contrainte qui mordra le plus tôt pour une PME
européenne est probablement le RGPD — hébergement, sous-traitance, consentement — davantage
que l'AI Act, qui porte sur le système d'IA lui-même plutôt que sur le transport des
messages. À faire vérifier par quelqu'un dont c'est le métier avant de vendre la
fonctionnalité, pas avant de la prototyper.

**Ce qui reste vrai de l'ancienne question.** L'affichage mobile de l'interface existe et n'a
**toujours jamais été vérifié à l'œil**. Il sert toujours à consulter, même si le pilotage
passe par le chat.

---

## 7. Poser un jalon stable

> **⬜ Non abordé au brainstorming.** Reste ouvert — et c'est la décision la moins chère de
> la liste.

**Ce dont il s'agit.** Le travail s'accumule sur la branche de développement des deux
projets. La branche stable n'a rien reçu depuis le début.

**Pourquoi ça compte un peu.** Un point de reprise identifié rend tout le reste plus facile à
raisonner : « avant ou après ce jalon » est une phrase qu'on peut dire, « avant ou après ce
mardi » beaucoup moins. Et les trois chantiers qui arrivent — bac à sable, authentification,
mode démon — vont remuer beaucoup de choses à la fois.

**Ce que je recommande.** Le poser maintenant, avant d'ouvrir ces trois chantiers plutôt
qu'après. C'est une pause volontaire, pas un oubli.

---

## Ce qui n'est pas à trancher

Pour éviter de rouvrir des débats déjà clos :

- **Le multi-utilisateur, le bac à sable, le mode démon** — tranchés le 2026-07-28. Ce qui
  reste à leur sujet est de la conception, plus de l'arbitrage.
- **Le langage de l'interface** — tranché le 2026-07-26 après examen. On y revient seulement
  si la décision 6 conclut « coquille native », et les critères sont écrits.
- **La direction artistique** — validée. Changer de palette coûterait un seul fichier.
- **L'indépendance des briques** — c'est le principe qui tient l'ensemble. Chaque brique
  publie ce qu'elle sait faire ; aucune ne connaît les entrailles d'une autre. Plusieurs
  recommandations de ce document en découlent directement.

---

## Un mot sur la méthode

Ce document ne cache pas les recommandations, il les marque. Là où j'écris « je
recommande », c'est un avis technique sur une question qui reste la vôtre. Là où j'écris que
quelque chose est bloqué, c'est un fait vérifié dans le code, pas une prudence.

Les décisions 2, 3 et 4 formaient un bloc, et il s'est résolu dans le bon ordre : la 2 est
tranchée, la 3 en découle, la 4 est reportée en connaissance de cause.

**Six décisions sur sept sont tranchées.** Reste le jalon (décision 7), qui ne bloque rien.

Trois questions nouvelles sont nées des réponses, et c'est normal — une décision ouvre le
niveau de détail en dessous :

- **Quelle messagerie en premier**, sachant que la plus utile aux PME est la plus coûteuse à
  livrer (décision 6a) ;
- **Une validation critique peut-elle passer par le chat**, ou seulement par l'interface
  (6b) — c'est une question de sécurité, pas de confort ;
- **Où les données ont le droit de transiter** (6c). Celle-là demande quelqu'un dont c'est
  le métier ; je peux la poser, pas y répondre.

Et deux apparaîtront au moment d'écrire plutôt qu'avant : l'étendue exacte du bac à sable, et
la façon dont un compte de messagerie se lie à un compte Kern.
