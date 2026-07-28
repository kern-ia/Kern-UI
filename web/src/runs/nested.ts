import type { Run } from './types'

/**
 * The runs a reader chose to look at: the ones that are not somebody's sub-agent.
 *
 * A nested run is already visible inside the node that produced it, so listing it again
 * beside its parent would show the same work twice and hide which of the two is the whole
 * story.
 */
export function topLevelRuns(runs: Run[]): Run[] {
  return runs.filter((run) => !run.parent)
}

/**
 * The nested run a subgraph node produced, if one has reported.
 *
 * A node may run its subgraph more than once — a retry, a loop — and each execution is its
 * own run. The freshest is the one worth drawing: it is what is happening, where the others
 * are history.
 */
export function childRunOf(runs: Run[], parentRunId: string, nodeId: string): Run | undefined {
  return runs
    .filter((run) => run.parent?.run_id === parentRunId && run.parent?.node_id === nodeId)
    .reduce<Run | undefined>(
      (newest, run) => (newest && newest.started_at >= run.started_at ? newest : run),
      undefined,
    )
}
