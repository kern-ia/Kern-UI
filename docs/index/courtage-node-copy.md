---
id: okf-035
feature: courtage-node-copy
branch: feature/courtage-node-copy
status: done
files:
  - web/src/i18n/fr.ts
decisions:
  - "2026-08-08 : hive.nodes ne couvrait que prospection et community-management-agency — les deux graphes réels d'Avel Finances (courtage-extraction, 18 nœuds, et courtage-banques, 1 nœud) n'avaient aucune ligne en langage clair, brand-agnostique ou pas. Trouvé et corrigé pendant le travail sur le thème Avel plutôt que supposé déjà couvert."
  - "2026-08-08 : contenu tiré des vrais fichiers Kern-Orch/examples/courtage-extraction.yaml et courtage-banques.yaml (prompts et commentaires de chaque nœud), jamais inventé — même discipline que le reste de fr.ts (aucun id technique, aucun nom de module)."
  - "2026-08-08 : ce contenu est commun à toute marque utilisant ces graphes — ce n'est pas la scission de vocabulaire par marque (encore à faire), juste une vraie lacune de couverture comblée avant de bâtir le mécanisme de bascule dessus."
