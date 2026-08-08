import { groupByDossier } from './dossiers'
import type { Run } from './types'

function run(id: string, over: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'g',
    status: 'running',
    step: 1,
    frontier: [],
    started_at: '2026-07-28T12:00:00Z',
    updated_at: '2026-07-28T12:00:00Z',
    ...over,
  }
}

describe('grouping runs by dossier', () => {
  it('groups runs sharing a dossier under one entry', () => {
    const runs = [
      run('a', { dossier: 'AF-2288' }),
      run('b', { dossier: 'AF-2288' }),
      run('c', { dossier: 'AF-2291' }),
    ]

    const dossiers = groupByDossier(runs)

    expect(dossiers).toHaveLength(2)
    expect(dossiers.find((d) => d.id === 'AF-2288')?.runs.map((r) => r.id)).toEqual(['a', 'b'])
  })

  // A run with no dossier has nothing to group it under — inventing a fake "none" entry
  // would show a case that does not exist.
  it('excludes runs with no dossier', () => {
    const runs = [run('a', { dossier: 'AF-2288' }), run('b')]

    expect(groupByDossier(runs)).toHaveLength(1)
  })

  // A nested run is already drawn inside the node that produced it — see nested.ts.
  it('excludes nested runs even when they carry a dossier', () => {
    const runs = [
      run('a', { dossier: 'AF-2288' }),
      run('child', { dossier: 'AF-2288', parent: { run_id: 'a', node_id: 'sub' } }),
    ]

    expect(groupByDossier(runs).find((d) => d.id === 'AF-2288')?.runs.map((r) => r.id)).toEqual(['a'])
  })

  it('orders dossiers by most recently updated first', () => {
    const runs = [
      run('old', { dossier: 'AF-2270', updated_at: '2026-07-28T10:00:00Z' }),
      run('new', { dossier: 'AF-2288', updated_at: '2026-07-28T14:00:00Z' }),
    ]

    expect(groupByDossier(runs).map((d) => d.id)).toEqual(['AF-2288', 'AF-2270'])
  })
})
