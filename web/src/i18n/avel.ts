/**
 * Avel Finances' voice, as an override layer on top of `kern.ts` rather than an
 * independent 359-line duplicate: every key not listed here inherits Kern's exact
 * wording and, more importantly, its exact TypeScript shape — nothing can silently drift
 * out of sync the way two hand-maintained copies could. See README.md, "Theming — one
 * codebase, several client brands", and docs/index/theming-convention.md.
 *
 * Only keys with real, mockup-grounded wording are overridden below
 * (design/mockups/avel-client.dc.html, avel-admin.dc.html). `views` and `systemState` are
 * deliberately NOT overridden yet: Kern's seven tabs (Cerveau/Agents/Espace/…) and its
 * four-state lifecycle (repos/réflexion/action/erreur) don't have a confirmed 1:1 Avel
 * wording — the admin mockup sketches a different information architecture (a dossier
 * list, not these seven tabs) that would need a real product decision, not a guessed
 * translation. Guessing here would look finished while being wrong.
 */
import { kern } from './kern'

export const avel = {
  ...kern,
  appName: 'Avel Finances',

  login: {
    ...kern.login,
    title: 'Avel Finances',
    subtitle: 'Connectez-vous pour suivre vos dossiers.',
  },

  runs: {
    ...kern.runs,
    heading: 'Suivi de vos dossiers',
    empty: 'Aucun dossier en cours.',
    emptyHint: 'Confiez un dossier à un agent : il apparaîtra ici en direct.',
  },

  grimoire: {
    ...kern.grimoire,
    competences: 'Automatisations',
    subAgents: 'Agents',
    label: 'Automatisations et agents',
    loading: 'Chargement des automatisations…',
    empty: 'Aucune automatisation installée.',
    emptyHint: 'Les automatisations installées apparaîtront ici.',
  },
} as const
