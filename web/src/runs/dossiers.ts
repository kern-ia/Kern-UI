import type { Run } from './types'

/** One dossier's runs, most recently updated first. */
export interface Dossier {
  id: string
  runs: Run[]
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
