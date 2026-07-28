import type { Run } from '../runs/types'

/**
 * The four states of the mockup's palette, all four now reachable from reported facts.
 *
 * `reflexion` needs the activity signal (`kern.activity/v1`); `erreur` needs only the run
 * failure that `kern.step-event/v2` already carries. None is ever produced from thin air.
 */
export type SystemState = 'repos' | 'reflexion' | 'action' | 'erreur'

/**
 * Derives the beacon state from the runs currently known.
 *
 * The order is by how much it asks of the reader. `reflexion` outranks `action` because
 * "a model is generating" is the more precise thing to say about a run that is also,
 * trivially, running. `erreur` only applies at rest: a live run is news, and a beacon stuck
 * red over a failure from an hour ago would be reporting history as if it were the present.
 *
 * That last point is why the failure is read from the **most recently updated** run rather
 * than from any run in the list. A failure is the current state of the system only while it
 * is the last thing that happened.
 */
export function systemState(runs: Run[]): SystemState {
  const live = runs.filter((r) => r.status === 'running')

  if (live.some((r) => (r.generating ?? []).length > 0)) return 'reflexion'
  if (live.length > 0) return 'action'

  return latest(runs)?.status === 'failed' ? 'erreur' : 'repos'
}

/** The run whose news is freshest, or undefined when there is none. */
function latest(runs: Run[]): Run | undefined {
  return runs.reduce<Run | undefined>(
    (newest, r) => (newest && newest.updated_at >= r.updated_at ? newest : r),
    undefined,
  )
}
