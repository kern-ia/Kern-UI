import { contentItemOf, isCommRun, mergeItems, monthGrid } from './marketing'
import type { ContentItem } from './marketing'
import type { Run } from '../runs/types'

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    graph: 'community-management-agency',
    status: 'finished',
    step: 6,
    frontier: [],
    visited: ['audience', 'strategiste', 'confirm_strategie', 'redacteur', 'confirm_publication', 'publieur'],
    started_at: '2026-08-06T10:00:00Z',
    updated_at: '2026-08-06T10:02:00Z',
    ...over,
  }
}

describe('isCommRun', () => {
  it('recognizes both community-management-agency graphs', () => {
    expect(isCommRun(run({ graph: 'community-management-agency' }))).toBe(true)
    expect(isCommRun(run({ graph: 'community-management-agency-auto' }))).toBe(true)
  })

  it('rejects an unrelated graph', () => {
    expect(isCommRun(run({ graph: 'prospection' }))).toBe(false)
  })
})

describe('contentItemOf', () => {
  it('returns null for a run outside the comm skills', () => {
    expect(contentItemOf(run({ graph: 'prospection' }))).toBeNull()
  })

  it('reads platform, date and title from a real finished run', () => {
    const r = run({
      state: {
        brief_editorial: '**Plateforme(s)** : LinkedIn uniquement.',
        plan_propose: '- Publier sur LinkedIn le 18/08/2026 : "Un post honnête"',
        texte_redige: 'Un post honnête\n\nLe corps du post...',
        'display:redacteur': 'Un post honnête',
      },
    })

    const item = contentItemOf(r)

    expect(item).not.toBeNull()
    expect(item!.platform).toBe('LinkedIn uniquement.')
    expect(item!.date).toEqual(new Date(2026, 7, 18))
    expect(item!.status).toBe('brouillon')
  })

  it('skips a meta-commentary preamble and a bare heading when picking the title', () => {
    // Real example found live: the redacteur's own note about how it wrote the post,
    // followed by a separator and a bare "**Post LinkedIn**" heading before the actual hook.
    const r = run({
      state: {
        brief_editorial: 'Plateforme(s) : LinkedIn',
        texte_redige:
          'Cadrage complet (angle, plateforme, public géré par le brief lui-même) — je rédige directement.\n\n---\n\n**Post LinkedIn**\n\nCombien de temps votre équipe passe à copier des chiffres ?\n\nPLAN DE PUBLICATION',
      },
    })

    expect(contentItemOf(r)!.title).toBe('Combien de temps votre équipe passe à copier des chiffres ?')
  })

  it('has no date when the plan only carries a placeholder', () => {
    const r = run({
      state: {
        brief_editorial: 'Plateforme(s) : email froid',
        plan_propose: '- Publier l\'email à [À COMPLÉTER : destinataire] le [À COMPLÉTER : date de publication] : test',
        texte_redige: 'Bonjour...',
      },
    })

    expect(contentItemOf(r)!.date).toBeNull()
  })

  it('marks a run whose publieur really sent as published', () => {
    const r = run({
      state: {
        brief_editorial: 'Plateforme(s) : Telegram',
        plan_propose: '- Publier sur Telegram le 06/08/2026 : test',
        texte_redige: 'Test.',
        execution: '✅ Envoyé sur Telegram (message_id 42).',
      },
    })

    expect(contentItemOf(r)!.status).toBe('publie')
  })

  it('marks a run whose strategy was refused as refused', () => {
    const r = run({
      visited: ['audience', 'strategiste', 'confirm_strategie', 'strategie_refusee'],
      state: { mode: 'proposition' },
    })

    expect(contentItemOf(r)!.status).toBe('refuse')
  })

  it('marks a run whose publication was refused as refused', () => {
    const r = run({
      visited: [
        'audience', 'strategiste', 'confirm_strategie', 'redacteur',
        'confirm_publication', 'refus_publication',
      ],
      state: { plan_propose: '- Publier sur X le 10/08/2026 : test' },
    })

    expect(contentItemOf(r)!.status).toBe('refuse')
  })

  it('marks a run still running as en_cours', () => {
    const r = run({ status: 'running', frontier: ['redacteur'] })

    expect(contentItemOf(r)!.status).toBe('en_cours')
  })

  it('falls back to a placeholder title when nothing usable is found', () => {
    const r = run({ state: {} })

    expect(contentItemOf(r)!.title).toBeTruthy()
  })
})

describe('monthGrid', () => {
  it('covers every day of the month, padded to full weeks', () => {
    const cells = monthGrid(2026, 7) // August 2026 (0-indexed month)

    expect(cells.length % 7).toBe(0)
    const inMonth = cells.filter((c) => c.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0].date.getDate()).toBe(1)
    expect(inMonth[30].date.getDate()).toBe(31)
  })

  it('places each item on the cell matching its date', () => {
    const items = [
      { runId: 'a', graph: 'g', title: 't', platform: 'p', date: new Date(2026, 7, 18), status: 'brouillon' as const, text: '' },
    ]

    const cells = monthGrid(2026, 7, items)
    const cell = cells.find((c) => c.inMonth && c.date.getDate() === 18)!

    expect(cell.items).toHaveLength(1)
    expect(cell.items[0].runId).toBe('a')
  })

  it('never assigns a dateless item to a cell', () => {
    const items = [
      { runId: 'a', graph: 'g', title: 't', platform: 'p', date: null, status: 'brouillon' as const, text: '' },
    ]

    const cells = monthGrid(2026, 7, items)

    expect(cells.every((c) => c.items.length === 0)).toBe(true)
  })
})

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    runId: 'a', graph: 'community-management-agency', title: 't', platform: 'p',
    date: null, status: 'brouillon', text: 'x', ...over,
  }
}

describe('mergeItems', () => {
  it('keeps a live item over a persisted one with the same runId', () => {
    const live = [item({ runId: 'a', title: 'live version' })]
    const persisted = [item({ runId: 'a', title: 'stale persisted version' })]

    const merged = mergeItems(live, persisted)

    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('live version')
  })

  it('keeps a persisted item whose run is no longer known live (e.g. after a kern-ui restart)', () => {
    const live: ContentItem[] = []
    const persisted = [item({ runId: 'b', title: 'survived a restart' })]

    const merged = mergeItems(live, persisted)

    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('survived a restart')
  })

  it('combines items from both sources with no overlap', () => {
    const live = [item({ runId: 'a' })]
    const persisted = [item({ runId: 'b' })]

    const merged = mergeItems(live, persisted)

    expect(merged.map((i) => i.runId).sort()).toEqual(['a', 'b'])
  })
})
