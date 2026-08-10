/**
 * Avel Finances' voice, as an override layer on top of `kern.ts` rather than an
 * independent 359-line duplicate: every key not listed here inherits Kern's exact
 * wording and, more importantly, its exact TypeScript shape — nothing can silently drift
 * out of sync the way two hand-maintained copies could. See README.md, "Theming — one
 * codebase, several client brands", and docs/index/theming-convention.md.
 *
 * Only keys with real, mockup-grounded wording are overridden below
 * (design/mockups/avel-client.dc.html, avel-admin.dc.html). `views` covers only the three
 * ids Avel's own view set actually uses (dossiers/suivi/automatisations, see
 * shell/views.ts's AVEL_VIEWS) — Kern's seven tabs stay inherited, unused under this
 * brand. `systemState` is deliberately NOT overridden: its four-state lifecycle
 * (repos/réflexion/action/erreur) doesn't have a confirmed 1:1 Avel wording yet, and
 * guessing here would look finished while being wrong.
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

  views: {
    ...kern.views,
    dossiers: 'Dossiers',
    suivi: 'Suivi agent',
    automatisations: 'Automatisations',
  },

  runs: {
    ...kern.runs,
    heading: 'Suivi de vos dossiers',
    empty: 'Aucun dossier en cours.',
    emptyHint: 'Confiez un dossier à un agent : il apparaîtra ici en direct.',
  },

  // dossiers: identical to kern's wording already — inherited via the top-level spread,
  // not re-listed here, so there is only one place it can drift from.

  dossierDetail: {
    notFound: 'Ce dossier est introuvable.',
    notFoundHint: 'Il a peut-être été refermé — revenez à la liste des dossiers.',
    backToList: 'Retour aux dossiers',
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
