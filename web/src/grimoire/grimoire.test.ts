import { activityOf, competences, glyphFor, subAgents } from './grimoire'
import type { Catalogue } from './types'
import type { Run } from '../runs/types'

const catalogue: Catalogue = {
  source: 'kern-orch',
  at: '2026-07-27T12:00:00Z',
  skills: [
    { name: 'Analyse', kind: 'tool', description: 'Décompose.' },
    { name: 'Scribe', kind: 'agent', description: 'Rédige.' },
    { name: 'Vigilance', kind: 'tool' },
    { name: 'Chercheur', kind: 'agent' },
  ],
}

describe('the two columns of the Grimoire', () => {
  it('puts tools under Compétences', () => {
    expect(competences(catalogue).map((s) => s.name)).toEqual(['Analyse', 'Vigilance'])
  })

  it('puts agents under Sous-agents', () => {
    expect(subAgents(catalogue).map((s) => s.name)).toEqual(['Scribe', 'Chercheur'])
  })

  it('loses nothing between the two', () => {
    const total = competences(catalogue).length + subAgents(catalogue).length
    expect(total).toBe(catalogue.skills.length)
  })
})

describe('glyphs', () => {
  // Glyphs are the interface's business, not the contract's: a brick sending an icon name
  // would be a brick doing our job. The eight the mockup names keep theirs.
  it('gives the mockup competences their own rune', () => {
    expect(glyphFor('Analyse')).toBe('ᛝ')
    expect(glyphFor('Synthèse')).toBe('ᚦ')
    expect(glyphFor('Vigilance')).toBe('ᛈ')
  })

  it('is case- and accent-insensitive, so a skill named in lowercase still matches', () => {
    expect(glyphFor('analyse')).toBe(glyphFor('Analyse'))
    expect(glyphFor('synthese')).toBe(glyphFor('Synthèse'))
  })

  it('gives an unknown skill a stable rune rather than nothing', () => {
    const first = glyphFor('Cartographie')
    expect(first).toBeTruthy()
    expect(glyphFor('Cartographie')).toBe(first)
  })

  it('does not hand every unknown skill the same rune', () => {
    const names = ['Cartographie', 'Traduction', 'Négociation', 'Archivage', 'Veille']
    expect(new Set(names.map(glyphFor)).size).toBeGreaterThan(1)
  })
})

// A run's node id is not a skill name — `greet` may run `planner` — so the link is the
// topology's declared skill reference and nothing else.
describe('activity of a sub-agent', () => {
  const run = (over: Partial<Run>): Run => ({
    id: 'r1',
    graph: 'hello',
    status: 'running',
    step: 1,
    frontier: [],
    started_at: '2026-07-27T12:00:00Z',
    updated_at: '2026-07-27T12:00:01Z',
    topology: {
      entry: 'greet',
      nodes: [
        { id: 'greet', kind: 'agent', skill: 'Scribe' },
        { id: 'finish', kind: 'tool' },
      ],
    },
    ...over,
  })

  it('is repos when no run exercises the skill', () => {
    expect(activityOf('Scribe', [])).toBe('repos')
  })

  it('is actif when a live frontier holds a node running that skill', () => {
    expect(activityOf('Scribe', [run({ frontier: ['greet'] })])).toBe('actif')
  })

  it('is repos when the node running it has already gone by', () => {
    expect(activityOf('Scribe', [run({ frontier: ['finish'], visited: ['greet'] })])).toBe('repos')
  })

  it('is bloque when the run failed on the node running that skill', () => {
    const failed = run({ status: 'failed', frontier: ['greet'], error: { message: 'boom' } })
    expect(activityOf('Scribe', [failed])).toBe('bloque')
  })

  it('reports trouble ahead of activity when both are true', () => {
    const failed = run({ id: 'r2', status: 'failed', frontier: ['greet'], error: { message: 'boom' } })
    expect(activityOf('Scribe', [run({ frontier: ['greet'] }), failed])).toBe('bloque')
  })

  // The whole point of carrying `skill` on the node: without it the only available match
  // is the node id, which names something else entirely.
  it('does not match a skill against a node id', () => {
    expect(activityOf('greet', [run({ frontier: ['greet'] })])).toBe('repos')
  })

  it('ignores a run that never declared its topology', () => {
    const bare = run({ frontier: ['greet'], topology: undefined })
    expect(activityOf('Scribe', [bare])).toBe('repos')
  })
})
