/**
 * The six views of the Agentic OS, in the order and with the glyphs of
 * design/mockups/Agentic OS.dc.html.
 *
 * Each view declares where its data comes from. Only `live` views show real data; the
 * others say on screen what they are waiting for rather than displaying invented content.
 * Promoting one is a one-line change here.
 */
export type ViewId = 'cerveau' | 'agents' | 'espace' | 'navigateur' | 'redaction' | 'grimoire'

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
export type Capability = 'memoire' | 'outils' | 'navigateur' | 'documents'

export interface ViewDef {
  id: ViewId
  glyph: string
  source: ViewSource
  /** Shown on mobile, where the mockup keeps a reduced navigation. */
  onMobile: boolean
}

export const VIEWS: ViewDef[] = [
  // kern-memory is decided in the roadmap but not built.
  { id: 'cerveau', glyph: '◎', source: { kind: 'awaiting', capability: 'memoire' }, onMobile: true },

  { id: 'agents', glyph: '⬡', source: { kind: 'live' }, onMobile: true },

  // Widgets stand for MCP servers, which are tools/skills the agent wires on demand — not
  // a brick of their own, and the Grimoire's contract now names them. What is still
  // missing is the reading behind each widget: a card shows a live measurement, and
  // nothing can be asked for one yet (C5).
  { id: 'espace', glyph: '▦', source: { kind: 'awaiting', capability: 'outils' }, onMobile: true },

  // Driving a browser would belong to kern-exec, which is not started.
  { id: 'navigateur', glyph: '◫', source: { kind: 'awaiting', capability: 'navigateur' }, onMobile: false },

  { id: 'redaction', glyph: '✎', source: { kind: 'awaiting', capability: 'documents' }, onMobile: false },

  // kern-orch publishes its skills catalogue on kern.registry/v1.
  { id: 'grimoire', glyph: 'ᛝ', source: { kind: 'live' }, onMobile: true },
]

export const DEFAULT_VIEW: ViewId = 'agents'

export function viewById(id: ViewId): ViewDef {
  const view = VIEWS.find((v) => v.id === id)
  if (!view) throw new Error(`unknown view: ${id}`)
  return view
}

/** The navigation the mockup keeps on a phone: three entries, not six. */
export function mobileViews(): ViewDef[] {
  return VIEWS.filter((v) => v.onMobile)
}
