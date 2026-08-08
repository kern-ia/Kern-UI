---
id: okf-034
feature: theming-convention
branch: docs/theming-convention
status: decision-only
files:
  - README.md
  - design/mockups/avel-client.dc.html
  - design/mockups/avel-admin.dc.html
decisions:
  - "2026-08-08 : deux maquettes construites pour Avel Finances (vue client, puis vue conseiller) dans la charte réelle du site avelfinances.fr — d'abord tentée avec la charte interne Grimoire Ambré côté conseiller par erreur, corrigée sur retour direct : « cette UI est celle de kern, avel à la sienne »."
  - "2026-08-08 : arbitrage repo séparé (kern-ui-avel) vs branche longue (avel) vs thème interne — rejeté les deux premiers (une branche/repo par client diverge du cœur à chaque fix, ne passe pas à l'échelle si un 2e client arrive). Choisi : un système de tokens de thème à l'intérieur de kern-ui, un build par marque, un déploiement par marque — documenté en détail dans le README avant tout code, sur demande explicite de l'utilisateur."
  - "2026-08-08 : vérifié avant de m'engager (pas supposé) — tokens.css existe déjà et est discipliné (var() quasi partout, 6 lignes hex isolées à corriger), donc le swap de palette est bon marché. fr.ts en revanche est un objet plat importé tel quel dans 24 fichiers — un deuxième vocabulaire de marque est un vrai chantier, pas un effet de bord du swap de couleurs. ConversationStone est un composant propre à Kern (pierre dorée, glow) — une marque dont la maquette montre un contrôle structurellement différent (la barre de commande d'Avel côté conseiller) a besoin de sa propre variante, pas d'un retheme."
  - "2026-08-08 : le backend Go n'a besoin d'aucun changement pour un thème par build — KERN_UI_WEB_DIR pointe déjà vers un bundle statique par instance ; un thème par marque, c'est juste une instance de plus du même patron que kern-launcher utilise déjà pour kern-memory/kern-orch/kern-ui. Le vrai coût (sélection d'un thème par compte/domaine dans UN SEUL binaire) n'est pas construit et n'est pas nécessaire tant qu'il n'y a qu'une poignée de marques."
