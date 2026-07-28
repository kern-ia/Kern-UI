import { systemState } from './systemState'
import type { Run } from '../runs/types'

function run(status: Run['status'], updated = '2026-07-26T12:00:00Z'): Run {
  return {
    id: Math.random().toString(36).slice(2),
    graph: 'g',
    status,
    step: 1,
    frontier: status === 'running' ? ['a'] : [],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: updated,
    ...(status === 'failed' ? { error: { message: 'boom' } } : {}),
  }
}

it('rests when nothing runs', () => {
  expect(systemState([])).toBe('repos')
  expect(systemState([run('finished')])).toBe('repos')
})

it('acts as soon as one run is live', () => {
  expect(systemState([run('finished'), run('running')])).toBe('action')
})

it('shows tension when the last thing that happened was a failure', () => {
  expect(systemState([run('failed')])).toBe('erreur')
})

// A failure is not a permanent condition. The beacon says what is true now, so a run that
// broke an hour ago must not keep the light red once something else has happened since.
it('stops showing tension once a later run has gone fine', () => {
  const broke = run('failed', '2026-07-26T12:00:00Z')
  const later = run('finished', '2026-07-26T13:00:00Z')

  expect(systemState([broke, later])).toBe('repos')
})

it('prefers a live run over an older failure', () => {
  const broke = run('failed', '2026-07-26T12:00:00Z')
  const live = run('running', '2026-07-26T13:00:00Z')

  expect(systemState([broke, live])).toBe('action')
})

// Réflexion outranks Action: while a model generates, that is the more precise thing to
// say about a run that is also, trivially, running.
it('thinks when an agent is generating', () => {
  const live = { ...run('running'), generating: ['a'] }

  expect(systemState([live])).toBe('reflexion')
})

it('acts, not thinks, when a run is live with nothing generating', () => {
  const live = { ...run('running'), generating: [] }

  expect(systemState([live])).toBe('action')
})

// The palette must never show a colour nothing produced. All four are reachable now, but
// only from reported facts.
it('never claims a state no brick can report', () => {
  const reachable = new Set(['repos', 'action', 'reflexion', 'erreur'])
  const samples = [[], [run('running')], [run('finished')], [run('failed')]]

  for (const runs of samples) {
    expect(reachable.has(systemState(runs))).toBe(true)
  }
})
