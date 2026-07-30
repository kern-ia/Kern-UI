/**
 * Every string the user reads. Code and comments are English; the interface is French.
 * No component may hard-code display copy — add it here.
 *
 * **This file is read by people who did not build the system.** It carries no engineering
 * vocabulary: no "run", no "graph", no "topology", no "node", no brick name, no filename.
 * A screen that names `kern-pilot` tells a client about our module layout and nothing about
 * their work. The word for each idea is fixed once here:
 *
 *   run → mission · graph/topology → déroulé · node → étape · level → étape
 *   frontier → en cours · skill → compétence · brick → the capability it provides
 *
 * Saying less is not the same as inventing: a view with no data still says what is missing,
 * in terms of what the reader wanted to do.
 */
export const fr = {
  appName: 'Kern-IA',

  login: {
    title: 'Kern-IA',
    subtitle: 'Identifiez-vous pour accéder à vos agents.',
    name: 'Identifiant',
    password: 'Mot de passe',
    submit: 'Entrer',
    submitting: 'Vérification…',
    // Deliberately says nothing about which of the two was wrong: the server does not tell
    // us, and it should not — that answer is a way to find out who works here.
    refused: 'Identifiant ou mot de passe incorrect.',
    unreachable: 'Le serveur ne répond pas. Réessayez dans un instant.',
    signOut: 'Se déconnecter',
    signedInAs: (name: string) => `Connecté en tant que ${name}`,
  },

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
    stoneHide: 'Ranger la conversation sur le côté',
    stoneShow: 'Déplier la conversation',
    // Sent as `/skill-name texte…`, matched against the catalogue.
    launching: 'Lancement…',
    launched: (name: string) => `Mission « ${name} » lancée.`,
    // No run selected, and the message was not a /compétence command.
    needsATarget: 'Ouvrez une mission ou tapez /suivi-d\'une-compétence.',
    unknownSkill: (known: string[]) =>
      known.length > 0
        ? `Compétence inconnue. Disponibles : ${known.join(', ')}.`
        : 'Compétence inconnue.',
    sendFailed: 'Le message n\'a pas pu être envoyé.',
    sentToRun: (graph: string) => `Message transmis à la mission « ${graph} ».`,
  },

  missing: {
    // One line per capability a view is waiting for. Written from what the reader wanted to
    // do, never from which module is missing: `kern-pilot` means nothing to them, and naming
    // it exposes our layout while explaining none of their work.
    awaiting: {
      memoire: "La mémoire des agents n'est pas encore branchée.",
      outils: 'Les outils connectés ne savent pas encore transmettre leurs valeurs.',
      navigateur: "Le pilotage du navigateur par un agent n'est pas encore branché.",
      documents: "L'espace de rédaction n'est pas encore branché.",
    },
    why: 'Rien n\'est affiché ici plutôt que des données inventées.',
  },

  hive: {
    label: (graph: string, count: number) =>
      `Déroulé de la mission ${graph}, ${count} étapes`,
    status: {
      pending: 'En attente',
      active: 'Actif',
      done: 'Terminé',
      failed: 'Bloqué',
    },
    noTopology: "Le déroulé de cette mission n'a pas été déclaré.",
    // A subgraph node is a whole graph. Opening it draws the run that happened inside.
    openNested: (node: string) => `Déplier le sous-agent ${node}`,
    closeNested: (node: string) => `Replier le sous-agent ${node}`,
    nestedOf: (node: string) => `Dans ${node}`,
    // A run opened by its activity signal is visible before any level has completed, so
    // its shape has not arrived yet. Saying it was never declared would be wrong.
    topologyPending: 'Le déroulé s\'affichera dès la première étape terminée.',
  },

  grimoire: {
    competences: 'Compétences',
    subAgents: 'Sous-agents',
    label: 'Grimoire des compétences et des sous-agents',
    loading: 'Chargement du grimoire…',
    // kern-orch holds the registry but has never pushed it here.
    unpublished: 'Le catalogue des compétences n\'a pas encore été reçu.',
    unpublishedHint: 'Il est transmis au démarrage de la première mission.',
    // Published, and genuinely empty — not the same thing.
    empty: 'Aucune compétence n\'est installée.',
    emptyHint: 'Les compétences installées apparaîtront ici.',
    error: 'Le catalogue des compétences n\'a pas pu être chargé.',
    activity: {
      actif: 'Actif',
      repos: 'Repos',
      bloque: 'Bloqué',
    },
    // Creating a skill or a sub-agent is a write path: it waits for kern-pilot, so the
    // mockup's `+` is shown and disabled rather than dropped or left to lie.
    newSubAgent: 'Nouveau sous-agent',
    newSkill: 'Nouvelle compétence',
    creationUnavailable: 'La création d\'agents n\'est pas encore disponible.',
  },

  espace: {
    label: 'Espace des outils connectés',
    loading: 'Chargement des outils…',
    // No source configured on kern-ui — distinct from kern-orch answering with none.
    unconfigured: 'Aucun outil n\'est connecté pour le moment.',
    unconfiguredHint: 'Un outil apparaîtra ici dès qu\'il sera branché.',
    // Configured and genuinely empty, or every tool still needs an argument binding that
    // does not exist yet — both read the same here: nothing to show without inventing a
    // card the mockup never drew an input for.
    empty: 'Aucun outil ne peut encore afficher sa valeur ici.',
    emptyHint: 'Certains outils attendent une configuration qui n\'existe pas encore.',
    error: 'Les outils connectés n\'ont pas pu être chargés.',
    widgetLoading: '…',
    widgetError: 'Valeur indisponible',
  },

  runs: {
    heading: 'Ruche des sous-agents',
    empty: 'Aucune mission pour le moment.',
    emptyHint: 'Confiez-en une à vos agents : elle apparaîtra ici en direct.',
    status: {
      running: 'En cours',
      finished: 'Terminé',
      failed: 'Échec',
    },
    select: (graph: string) => `Voir le déroulé de la mission ${graph}`,
    step: (n: number) => `Étape ${n}`,
    frontier: 'En cours',
    idle: 'En attente',
    count: (n: number) => (n === 1 ? '1 mission' : `${n} missions`),
    stop: 'Arrêter',
    stopping: 'Arrêt…',
    // Someone else asked for this mission — steering it is theirs to do, not this reader's.
    stopUnavailable: 'Seul le demandeur de cette mission peut l\'arrêter.',
    awaitingDecision: (label: string) => `« ${label} » attend une décision.`,
    approve: 'Valider',
    refuse: 'Refuser',
    deciding: '…',
    decisionFailed: 'La décision n\'a pas pu être transmise.',
  },

  redaction: {
    label: 'Documents',
    loading: 'Chargement des documents…',
    // No source configured on kern-ui — distinct from kern-memory answering with none.
    unconfigured: 'Aucun document n\'est connecté pour le moment.',
    unconfiguredHint: 'Un document apparaîtra ici dès qu\'une source sera branchée.',
    empty: 'Aucun document pour le moment.',
    error: 'Les documents n\'ont pas pu être chargés.',
    documentError: 'Ce document n\'a pas pu être chargé.',
    wordCount: (n: number) => (n === 1 ? '1 mot' : `${n} mots`),
    updated: (r: { unit: 'now' } | { unit: 'minutes' | 'hours' | 'days'; count: number }) => {
      if (r.unit === 'now') return 'sauvegardé à l\'instant'
      const label = { minutes: 'min', hours: 'h', days: 'j' } as const
      return `sauvegardé il y a ${r.count} ${label[r.unit]}`
    },
    suggestion: (title: string) => `Suggestion — ${title}`,
    accept: 'Accepter',
    ignore: 'Ignorer',
    resolving: '…',
    resolveFailed: 'La décision n\'a pas pu être transmise.',
  },
} as const
