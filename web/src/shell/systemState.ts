import type { Run } from '../runs/types'

/**
 * The four states of the mockup's palette. Only `repos` and `action` are reachable from
 * what kern-orch reports today; `reflexion` and `erreur` wait for a brick that can say an
 * agent is thinking or that a run failed. They stay in the type so the palette is complete,
 * never produced from thin air.
 */
export type SystemState = 'repos' | 'reflexion' | 'action' | 'erreur'

/** Derives the beacon state from the runs currently known. */
export function systemState(runs: Run[]): SystemState {
  return runs.some((r) => r.status === 'running') ? 'action' : 'repos'
}
