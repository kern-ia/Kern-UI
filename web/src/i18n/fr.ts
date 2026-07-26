/**
 * Every string the user reads. Code and comments are English; the interface is French.
 * No component may hard-code display copy — add it here.
 */
export const fr = {
  appName: 'Kern-IA',

  nav: {
    primary: 'Navigation',
    compact: 'Navigation compacte',
  },

  views: {
    cerveau: 'Cerveau',
    agents: 'Agents',
    espace: 'Espace',
    navigateur: 'Navigateur',
    redaction: 'Rédaction',
    grimoire: 'Grimoire',
  },

  systemState: {
    repos: 'Repos',
    reflexion: 'Réflexion',
    action: 'Action',
    erreur: 'Tension',
  },

  connection: {
    connecting: 'Connexion…',
    open: 'En direct',
    error: 'Hors ligne',
  },

  chat: {
    placeholder: 'Demande-moi n\'importe quoi…',
    // The conversation bar is part of the design but has nothing to talk to: steering an
    // agent is kern-pilot's job, and that brick is not started.
    unavailable: 'La conversation attend la brique kern-pilot.',
    stoneHide: 'Ranger la conversation sur le côté',
    stoneShow: 'Déplier la conversation',
  },

  missing: {
    noBrick: 'Cette vue attend une brique qui n\'existe pas encore.',
    noContract: (brick: string) =>
      `${brick} détient ces données mais ne publie aucun contrat pour les exposer.`,
    why: 'Rien n\'est affiché ici plutôt que des données inventées.',
    roadmap: 'Voir la cartographie des briques dans Kern-Orch/docs/ROADMAP.md',
  },

  hive: {
    label: (graph: string, count: number) => `Graphe du run ${graph}, ${count} nœuds`,
    status: {
      pending: 'En attente',
      active: 'Actif',
      done: 'Terminé',
      failed: 'Bloqué',
    },
    noTopology: "Ce run n'a pas déclaré sa topologie.",
  },

  runs: {
    heading: 'Ruche des sous-agents',
    empty: 'Aucun run pour le moment.',
    emptyHint: 'Lance un graphe kern-orch : il apparaîtra ici en direct.',
    status: {
      running: 'En cours',
      finished: 'Terminé',
      failed: 'Échec',
    },
    select: (graph: string) => `Voir le graphe du run ${graph}`,
    step: (n: number) => `Niveau ${n}`,
    frontier: 'Frontière',
    idle: 'En attente',
    count: (n: number) => (n === 1 ? '1 run' : `${n} runs`),
  },
} as const
