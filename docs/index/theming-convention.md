---
id: okf-034
feature: theming-convention
branch: docs/theming-convention, feature/brand-tokens
status: token layer done; copy (fr.ts) and ConversationStone variant not started
files:
  - README.md
  - design/mockups/avel-client.dc.html
  - design/mockups/avel-admin.dc.html
  - web/src/styles/tokens.css
  - web/src/styles/brand-kern.css
  - web/src/styles/brand-avel.css
  - web/src/main.tsx
  - web/index.html
  - web/vite.config.ts
  - web/src/shell/ConversationStone.module.css
  - web/src/redaction/RedactionView.module.css
decisions:
  - "2026-08-08 : tokens.css scindé — spacing/rayons/règles de base restent partagés dans tokens.css ; les tokens de marque (couleur, police) déménagent dans brand-kern.css (défaut, valeurs inchangées) et brand-avel.css (`:root[data-brand=\"avel\"]`, spécificité plus forte donc gagne toujours quand l'attribut est présent). Les 6 lignes hex isolées trouvées par la recherche précédente (ConversationStone.module.css, RedactionView.module.css) sont maintenant des tokens (--stone-gradient, --stone-rune-color, --suggestion-accent, --suggestion-text) — plus aucun hex en dur hors des fichiers de tokens (vérifié par grep)."
  - "2026-08-08 : sélection de marque = attribut data-brand sur <html>, injecté au build par le remplacement %VITE_BRAND% natif de Vite (aucun JS, aucun flash) — vite.config.ts défaut VITE_BRAND=kern (pas de .env, qui serait avalé par .gitignore) et route outDir vers internal/httpapi/dist pour kern, ../dist-<brand> sinon, donc un build de marque ne peut jamais écraser le build par défaut."
  - "2026-08-08 : vérifié en vrai, pas juste en lisant le CSS généré — build kern (make build) inchangé, build avel (VITE_BRAND=avel npm run build) servi par un vrai kern-ui sur le port 7799, capture d'écran confirmant le fond navy/l'accent bleu/le gradient de la pierre en bleu, ET la Ruche/le Grimoire/le vocabulaire Kern restés intacts (le swap de vocabulaire est un chantier séparé, pas fait ici). make test : 267 tests front + tous les paquets Go verts après le changement."
  - "2026-08-08 : périmètre volontairement NON traité ici — fr.ts (359 lignes, importé tel quel dans 24 fichiers) et une vraie variante Avel de ConversationStone (le mockup conseiller remplace la pierre par une barre de commande plate). Les deux restent des chantiers à part, comme annoncé dans le README avant de commencer celui-ci."
  - "2026-08-08 : deux maquettes construites pour Avel Finances (vue client, puis vue conseiller) dans la charte réelle du site avelfinances.fr — d'abord tentée avec la charte interne Grimoire Ambré côté conseiller par erreur, corrigée sur retour direct : « cette UI est celle de kern, avel à la sienne »."
  - "2026-08-08 : arbitrage repo séparé (kern-ui-avel) vs branche longue (avel) vs thème interne — rejeté les deux premiers (une branche/repo par client diverge du cœur à chaque fix, ne passe pas à l'échelle si un 2e client arrive). Choisi : un système de tokens de thème à l'intérieur de kern-ui, un build par marque, un déploiement par marque — documenté en détail dans le README avant tout code, sur demande explicite de l'utilisateur."
  - "2026-08-08 : vérifié avant de m'engager (pas supposé) — tokens.css existe déjà et est discipliné (var() quasi partout, 6 lignes hex isolées à corriger), donc le swap de palette est bon marché. fr.ts en revanche est un objet plat importé tel quel dans 24 fichiers — un deuxième vocabulaire de marque est un vrai chantier, pas un effet de bord du swap de couleurs. ConversationStone est un composant propre à Kern (pierre dorée, glow) — une marque dont la maquette montre un contrôle structurellement différent (la barre de commande d'Avel côté conseiller) a besoin de sa propre variante, pas d'un retheme."
  - "2026-08-08 : le backend Go n'a besoin d'aucun changement pour un thème par build — KERN_UI_WEB_DIR pointe déjà vers un bundle statique par instance ; un thème par marque, c'est juste une instance de plus du même patron que kern-launcher utilise déjà pour kern-memory/kern-orch/kern-ui. Le vrai coût (sélection d'un thème par compte/domaine dans UN SEUL binaire) n'est pas construit et n'est pas nécessaire tant qu'il n'y a qu'une poignée de marques."
