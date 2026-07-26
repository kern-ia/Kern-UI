/**
 * Every string the user reads. Code and comments are English; the interface is French.
 * No component may hard-code display copy — add it here.
 */
export const fr = {
  appName: 'Kern-IA',
  nav: {
    runs: 'Runs',
  },
  connection: {
    connecting: 'Connexion…',
    open: 'En direct',
    error: 'Hors ligne',
  },
  runs: {
    heading: 'Runs en cours',
    empty: 'Aucun run pour le moment.',
    emptyHint: 'Lance un graphe kern-orch : il apparaîtra ici en direct.',
    status: {
      running: 'En cours',
      finished: 'Terminé',
    },
    step: (n: number) => `Niveau ${n}`,
    frontier: 'Frontière',
    idle: 'En attente',
    startedAt: 'Démarré',
    count: (n: number) => (n === 1 ? '1 run' : `${n} runs`),
  },
} as const
