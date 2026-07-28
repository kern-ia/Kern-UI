import { mergeRun } from './merge'
import type { Run } from './types'

function run(id: string, startedAt: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'review',
    status: 'running',
    step: 1,
    frontier: ['analyse'],
    started_at: startedAt,
    updated_at: startedAt,
    ...overrides,
  }
}

it('inserts an unknown run', () => {
  const merged = mergeRun([], run('r1', '2026-07-26T12:00:00Z'))

  expect(merged.map((r) => r.id)).toEqual(['r1'])
})

it('replaces a known run instead of duplicating it', () => {
  const before = [run('r1', '2026-07-26T12:00:00Z')]

  const merged = mergeRun(before, run('r1', '2026-07-26T12:00:00Z', { step: 7 }))

  expect(merged).toHaveLength(1)
  expect(merged[0].step).toBe(7)
})

it('does not mutate the array it is given', () => {
  const before = [run('r1', '2026-07-26T12:00:00Z')]

  mergeRun(before, run('r1', '2026-07-26T12:00:00Z', { step: 7 }))

  expect(before[0].step).toBe(1)
})

it('orders by start date, most recent first', () => {
  let runs: Run[] = []
  runs = mergeRun(runs, run('old', '2026-07-26T12:00:00Z'))
  runs = mergeRun(runs, run('new', '2026-07-26T12:00:05Z'))
  runs = mergeRun(runs, run('middle', '2026-07-26T12:00:02Z'))

  expect(runs.map((r) => r.id)).toEqual(['new', 'middle', 'old'])
})

it('breaks ties on id so the order stays stable', () => {
  let runs: Run[] = []
  runs = mergeRun(runs, run('b', '2026-07-26T12:00:00Z'))
  runs = mergeRun(runs, run('a', '2026-07-26T12:00:00Z'))

  expect(runs.map((r) => r.id)).toEqual(['a', 'b'])
})
