import type { Run } from './types'

/**
 * Folds one run into the list, replacing any run with the same id.
 *
 * The ordering mirrors the backend's List(): most recently started first, ties broken on
 * id so a run never jumps around between renders.
 */
export function mergeRun(runs: Run[], incoming: Run): Run[] {
  const next = runs.filter((r) => r.id !== incoming.id)
  next.push(incoming)
  return sortRuns(next)
}

/** Orders runs the way the backend does. */
export function sortRuns(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => {
    if (a.started_at === b.started_at) return a.id.localeCompare(b.id)
    return a.started_at < b.started_at ? 1 : -1
  })
}
