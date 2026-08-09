/**
 * The seven views of the Agentic OS, in the order and with the glyphs of
 * design/mockups/Agentic OS.dc.html.
 *
 * Each view declares where its data comes from. Only `live` views show real data; the
 * others say on screen what they are waiting for rather than displaying invented content.
 * Promoting one is a one-line change here.
 *
 * Vigie (added 2026-08-05) reads consumption and behaviour data relayed from the AI
 * firewall — the mockup was updated alongside this file rather than left to drift, since
 * it is this file's own stated source of truth for the view count.
 */
export type ViewId =
  | 'cerveau'
  | 'agents'
  | 'espace'
  | 'navigateur'
  | 'redaction'
  | 'grimoire'
  | 'vigie'
  | 'dossiers'
  | 'suivi'
  | 'automatisations'

export type ViewSource =
  /** A brick feeds this view today. */
  | { kind: 'live' }
  /** Nothing feeds it yet; it says which capability it is waiting for. */
  | { kind: 'awaiting'; capability: Capability }

/**
 * What a view is missing, named by what the reader cannot do rather than by the module that
 * would provide it.
 *
 * The distinction this used to carry — a brick that exists but publishes nothing, versus one
 * that is not built — is real and is recorded in docs/expected-contracts.md. It is invisible
 * to whoever is looking at the screen, so it does not belong here.
 */
export type Capability = 'memoire' | 'outils' | 'navigateur' | 'documents' | 'supervision'

export interface ViewDef {
  id: ViewId
  glyph: string
  source: ViewSource
  /** Shown on mobile, where the mockup keeps a reduced navigation. */
  onMobile: boolean
  /**
   * A sidebar section label, grouping consecutive views under one heading (a copy key
   * under `fr.shell.sections`). Optional: Kern's own seven views have no validated
   * grouping to draw from (no mockup groups them), so they render as one flat list
   * rather than a guessed taxonomy — only brands whose mockup actually groups its nav
   * (Avel's "Opérations"/"Configuration") set this.
   */
  section?: 'operations' | 'configuration'
}

export const VIEWS: ViewDef[] = [
  // kern-memory is decided in the roadmap but not built.
  { id: 'cerveau', glyph: '◎', source: { kind: 'awaiting', capability: 'memoire' }, onMobile: true },

  { id: 'agents', glyph: '⬡', source: { kind: 'live' }, onMobile: true },

  // kern-orch reads a widget's value on request (C5). Only a tool with no required param
  // becomes a card: a required one has no config saying what to bind it to yet.
  { id: 'espace', glyph: '▦', source: { kind: 'live' }, onMobile: true },

  // Driving a browser would belong to kern-exec, which is not started.
  { id: 'navigateur', glyph: '◫', source: { kind: 'awaiting', capability: 'navigateur' }, onMobile: false },

  // kern-memory (C8's storage slice) serves documents and suggestions on request.
  { id: 'redaction', glyph: '✎', source: { kind: 'live' }, onMobile: false },

  // kern-orch publishes its skills catalogue on kern.registry/v1.
  { id: 'grimoire', glyph: 'ᛝ', source: { kind: 'live' }, onMobile: true },

  // The AI firewall's C4 (budget) and C3 (decisions, relayed) — see internal/firewall.
  // Live regardless of whether a deployment actually configured KERN_FIREWALL_URL: the
  // route always exists, and VigieView itself renders 'unconfigured' at runtime, the
  // same split Espace already makes for a tool source.
  { id: 'vigie', glyph: '◉', source: { kind: 'live' }, onMobile: false },
]

/**
 * Avel Finances' advisor console: a Dossiers list, a Suivi (per-dossier timeline) view,
 * and an Automatisations catalogue — a different information architecture from Kern's
 * seven tabs, not a relabelling of them. See README.md, "Theming — one codebase, several
 * client brands", and docs/index/theming-convention.md for why brand selection is
 * build-time (VITE_BRAND), not a runtime data-brand check.
 */
export const AVEL_VIEWS: ViewDef[] = [
  { id: 'dossiers', glyph: '▤', source: { kind: 'live' }, onMobile: true, section: 'operations' },
  { id: 'suivi', glyph: '⬡', source: { kind: 'live' }, onMobile: true, section: 'operations' },
  {
    id: 'automatisations',
    glyph: 'ᛝ',
    source: { kind: 'live' },
    onMobile: true,
    section: 'configuration',
  },
]

/** The active brand's view set, decided at build time. */
export function activeViews(): ViewDef[] {
  return import.meta.env.VITE_BRAND === 'avel' ? AVEL_VIEWS : VIEWS
}

export function defaultView(): ViewId {
  return import.meta.env.VITE_BRAND === 'avel' ? 'dossiers' : 'agents'
}

export function viewById(id: ViewId): ViewDef {
  const view = activeViews().find((v) => v.id === id)
  if (!view) throw new Error(`unknown view: ${id}`)
  return view
}

/** The navigation the mockup keeps on a phone: three entries, not six. */
export function mobileViews(): ViewDef[] {
  return activeViews().filter((v) => v.onMobile)
}
