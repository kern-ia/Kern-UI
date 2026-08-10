import { nodeStatus } from './hive'
import type { Run } from './types'

/** One dossier's runs, most recently updated first. */
export interface Dossier {
  id: string
  runs: Run[]
}

/**
 * A dossier's status in business terms, not a raw run status — matching
 * avel-admin.dc.html's own vocabulary (attente-de-vous / agent-en-cours / terminé /
 * bloqué), derived from real run + topology data, never a separate field the backend
 * would need to add.
 */
export type DossierStatus = 'waiting' | 'active' | 'done' | 'failed'

export function dossierStatus(run: Run): DossierStatus {
  if (run.status === 'failed') return 'failed'
  if (run.status === 'finished') return 'done'
  const waitingOnYou = run.topology?.nodes.some(
    (n) => n.kind === 'approval' && nodeStatus(run, n.id) === 'active',
  )
  return waitingOnYou ? 'waiting' : 'active'
}

/** The node currently doing the work, if the run has declared its shape yet. */
export function currentNodeId(run: Run): string | null {
  return run.frontier[0] ?? null
}

/**
 * Groups top-level runs by their dossier, most recently updated dossier first.
 *
 * A run with no dossier has nothing to group it under — it is excluded rather than
 * bucketed into a fake "none" entry, which would invent a case that does not exist.
 * Nested runs are excluded too: a sub-agent's run is already visible inside the node
 * that produced it (see topLevelRuns), so it does not get its own dossier row either.
 */
export function groupByDossier(runs: Run[]): Dossier[] {
  const byId = new Map<string, Run[]>()
  for (const run of runs) {
    if (run.parent || !run.dossier) continue
    const list = byId.get(run.dossier)
    if (list) {
      list.push(run)
    } else {
      byId.set(run.dossier, [run])
    }
  }

  const dossiers = Array.from(byId, ([id, dossierRuns]) => ({ id, runs: dossierRuns }))
  dossiers.sort((a, b) => latestUpdate(b.runs).localeCompare(latestUpdate(a.runs)))
  return dossiers
}

function latestUpdate(runs: Run[]): string {
  return runs.reduce((latest, run) => (run.updated_at > latest ? run.updated_at : latest), '')
}
