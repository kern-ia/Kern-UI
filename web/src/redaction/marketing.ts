import type { Run } from '../runs/types'

/**
 * Reads community-management-agency(-auto) runs as marketing content — a calendar/history
 * view over the same run data the Agents timeline already draws, not a new backend. kern-ui
 * still stores nothing on disk (see next-steps.md): this history exists only for the runs
 * this kern-ui process has actually seen since it started.
 */
const COMM_GRAPHS = ['community-management-agency', 'community-management-agency-auto']

export function isCommRun(run: Run): boolean {
  return COMM_GRAPHS.includes(run.graph)
}

export type ContentStatus = 'publie' | 'brouillon' | 'refuse' | 'en_cours'

export interface ContentItem {
  runId: string
  graph: string
  title: string
  platform: string
  /** Null when the drafted plan only carries a "[À COMPLÉTER]" placeholder for the date. */
  date: Date | null
  status: ContentStatus
  text: string
}

const PLATFORM_RE = /plateforme(\(s\))?[*_\s]*:\s*([^\n]+)/i
const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/
const REFUSED_NODES = ['strategie_refusee', 'refus_publication']

function stateOf(run: Run): Record<string, unknown> {
  return (run.state as Record<string, unknown>) ?? {}
}

function textOf(data: Record<string, unknown>, key: string): string {
  const v = data[key]
  return typeof v === 'string' ? v : ''
}

function platformOf(brief: string): string {
  const m = PLATFORM_RE.exec(brief)
  return m ? m[2].trim() : 'Non précisé'
}

function dateOf(plan: string): Date | null {
  const m = DATE_RE.exec(plan)
  if (!m) return null
  const [, day, month, year] = m
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function titleOf(texte: string, plan: string): string {
  const objet = /^objet\s*:\s*(.+)$/im.exec(texte)
  if (objet) return objet[1].trim()

  // Real example found live: redacteur sometimes opens with a meta-commentary paragraph
  // ("Cadrage complet... — je rédige directement.") before a "---" separator, then a bare
  // "**Post LinkedIn**" heading — neither is the actual content. Skip past both when
  // present rather than surfacing an internal note as the item's title.
  const afterSeparator = texte.split(/\n-{3,}\n/).at(-1) ?? texte
  const heading = /^\*\*(.+?)\*\*\s*$/m.exec(afterSeparator)
  const body = heading ? afterSeparator.slice(heading.index + heading[0].length) : afterSeparator

  const firstLine = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^plan de publication$/i.test(l))
  if (firstLine) return firstLine.slice(0, 80)

  const planLine = plan.split('\n').find((l) => l.trim().length > 0)
  return planLine?.trim().slice(0, 80) || '(sans titre)'
}

function statusOf(run: Run, execution: string): ContentStatus {
  const visited = run.visited ?? []
  if (REFUSED_NODES.some((n) => visited.includes(n))) return 'refuse'
  if (execution.startsWith('✅')) return 'publie'
  if (run.status !== 'finished') return 'en_cours'
  return 'brouillon'
}

/** Null for a run outside the comm skills — every other field is best-effort from whatever
 * state the run has reached so far, never thrown on missing data. */
export function contentItemOf(run: Run): ContentItem | null {
  if (!isCommRun(run)) return null

  const data = stateOf(run)
  const brief = textOf(data, 'brief_editorial')
  const plan = textOf(data, 'plan_propose')
  const texte = textOf(data, 'texte_redige')
  const execution = textOf(data, 'execution')

  return {
    runId: run.id,
    graph: run.graph,
    title: titleOf(texte, plan),
    platform: platformOf(brief),
    date: dateOf(plan),
    status: statusOf(run, execution),
    text: texte,
  }
}

export interface CalendarCell {
  date: Date
  inMonth: boolean
  items: ContentItem[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * A calendar grid for `month` (0-indexed) of `year`, padded to full weeks (Monday first)
 * so the grid always renders as complete rows. Items are placed on the cell matching their
 * date; a dateless item (see ContentItem.date) never appears in the grid — the caller lists
 * those separately.
 */
export function monthGrid(year: number, month: number, items: ContentItem[] = []): CalendarCell[] {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - startOffset)

  const last = new Date(year, month + 1, 0)
  const endOffset = (7 - ((last.getDay() + 6) % 7) - 1) % 7
  const totalDays = startOffset + last.getDate() + endOffset

  const dated = items.filter((i): i is ContentItem & { date: Date } => i.date !== null)

  const cells: CalendarCell[] = []
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start.getTime() + i * DAY_MS)
    cells.push({
      date,
      inMonth: date.getMonth() === month,
      items: dated.filter((it) => sameDay(it.date, date)),
    })
  }
  return cells
}
