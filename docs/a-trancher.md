# À trancher

Les décisions qui attendent une réponse humaine, expliquées sans jargon.

> **Pourquoi ce document existe.** `expected-contracts.md` dit la même chose en langage
> technique, pour ceux qui écrivent le code. Celui-ci s'adresse à ceux qui décident. Les deux
> restent d'accord : quand une décision est prise ici, elle est reportée là-bas.
>
> _Exception assumée aux conventions du repo : tout ce qui vit dans `docs/` est en anglais.
> Ce fichier est en français parce qu'il sert à une discussion, pas à du code._

Écrit le 2026-07-28.

---

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

## Les décisions, par ordre d'urgence

| # | Décision | Urgence | Ce qui attend |
|---|---|---|---|
| 1 | Le confinement des agents | **Maintenant** | Rien — c'est un risque ouvert |
| 2 | Plusieurs utilisateurs, ou un seul ? | Élevée | Les décisions 3, 4 et une partie de 5 |
| 3 | Protéger l'accès à l'interface | Élevée | Toute utilisation à plus d'une personne |
| 4 | Qui crée les sous-agents, et où vivent-ils ? | Moyenne | Le bouton « Nouveau sous-agent » |
| 5 | Les outils doivent-ils tourner en permanence ? | Moyenne | La vue Espace et ses widgets |
| 6 | Le mobile : consulter, ou vraiment s'en servir ? | Basse | Le choix d'une coquille native |
| 7 | Poser un jalon stable | Basse | Rien, mais c'est bon marché |

---

## 1. Le confinement des agents

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

---

## 5. Les outils doivent-ils tourner en permanence ?

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

## 6. Le mobile : consulter, ou vraiment s'en servir ?

**Ce dont il s'agit.** L'interface est un site web servi par un programme unique. Sur
téléphone, elle s'affiche dans le navigateur. Une autre approche — dite « coquille native » —
produirait une vraie application installable.

**Deux questions décident, pas le débat technique.**

**a) Que doit faire le téléphone ?** Si c'est **consulter** — voir où en sont les agents
depuis le canapé — ce qui existe suffit. Si c'est **être présent dans les magasins
d'applications et recevoir des notifications fiables**, il faut la coquille native.

**b) La surveillance et l'écran d'approbation doivent-ils tourner ensemble ?** Le jour où un
agent demandera « puis-je faire ceci ? », il y aura un écran de validation. Si le mécanisme
qui applique les règles doit être **dans le même programme** que cet écran — pour qu'on ne
puisse pas contourner l'un sans l'autre — la coquille native prend tout son sens. Si les
briques restent des programmes séparés qui se parlent, elle n'apporte rien.

**Rien n'est perdu dans un cas comme dans l'autre** : la coquille native, si elle arrive,
enveloppe exactement l'interface actuelle. Ce n'est pas un travail à refaire.

**À savoir** : l'affichage sur téléphone est écrit mais **jamais vérifié à l'œil**. L'outil
de test refuse de redimensionner la fenêtre. À regarder sur un vrai téléphone avant de
conclure quoi que ce soit.

---

## 7. Poser un jalon stable

**Ce dont il s'agit.** Le travail s'accumule sur la branche de développement des deux
projets. La branche stable n'a rien reçu depuis le début.

**Pourquoi ça compte un peu.** Un point de reprise identifié rend tout le reste plus facile à
raisonner : « avant ou après ce jalon » est une phrase qu'on peut dire, « avant ou après ce
mardi » beaucoup moins.

**Ce que je recommande.** Le faire dès que l'équipe est d'accord pour dire que l'état actuel
est présentable. C'est une pause volontaire, pas un oubli. Ça ne coûte presque rien et ça ne
ferme aucune porte.

---

## Ce qui n'est pas à trancher

Pour éviter de rouvrir des débats déjà clos :

- **Le langage de l'interface** — tranché le 2026-07-26 après examen. On y revient seulement
  si la décision 6 dit « coquille native », et les critères sont écrits.
- **La direction artistique** — validée. Changer de palette coûterait un seul fichier.
- **L'indépendance des briques** — c'est le principe qui tient l'ensemble. Chaque brique
  publie ce qu'elle sait faire ; aucune ne connaît les entrailles d'une autre. Plusieurs
  recommandations de ce document en découlent directement.

---

## Un mot sur la méthode

Ce document ne cache pas les recommandations, il les marque. Là où j'écris « je
recommande », c'est un avis technique sur une question qui reste la vôtre. Là où j'écris que
quelque chose est bloqué, c'est un fait vérifié dans le code, pas une prudence.

Les décisions 2, 3 et 4 forment un bloc : la 2 commande les deux autres. Les prendre dans le
désordre revient à construire deux fois.
