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
    detail: {
      // The registry now reaches the interface, so the Espace no longer waits for the
      // catalogue — only for the readings that fill a widget.
      espaceValues:
        'Le catalogue des outils est publié ; il manque la lecture de leur valeur (contrat C5).',
    },
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
    // A subgraph node is a whole graph. Opening it draws the run that happened inside.
    openNested: (node: string) => `Déplier le sous-agent ${node}`,
    closeNested: (node: string) => `Replier le sous-agent ${node}`,
    nestedOf: (node: string) => `Dans ${node}`,
    // A run opened by its activity signal is visible before any level has completed, so
    // its shape has not arrived yet. Saying it was never declared would be wrong.
    topologyPending: 'Topologie en attente du premier niveau.',
  },

  grimoire: {
    competences: 'Compétences',
    subAgents: 'Sous-agents',
    label: 'Grimoire des compétences et des sous-agents',
    loading: 'Chargement du grimoire…',
    // kern-orch holds the registry but has never pushed it here.
    unpublished: 'kern-orch n\'a pas encore publié son catalogue de skills.',
    unpublishedHint:
      'Lance un graphe, ou `kern-orch publish-skills`, avec KERN_REGISTRY_REPORT_URL défini.',
    // Published, and genuinely empty — not the same thing.
    empty: 'kern-orch ne déclare aucun skill.',
    emptyHint: 'Ajoute un dossier contenant un SKILL.md dans son répertoire de skills.',
    error: 'Le catalogue des skills n\'a pas pu être chargé.',
    activity: {
      actif: 'Actif',
      repos: 'Repos',
      bloque: 'Bloqué',
    },
    // Creating a skill or a sub-agent is a write path: it waits for kern-pilot, so the
    // mockup's `+` is shown and disabled rather than dropped or left to lie.
    newSubAgent: 'Nouveau sous-agent',
    newSkill: 'Nouvelle compétence',
    creationUnavailable: 'La création attend la brique kern-pilot.',
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
