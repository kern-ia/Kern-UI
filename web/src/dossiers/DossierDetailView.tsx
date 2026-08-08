import { fr } from '../i18n/fr'
import styles from './DossierDetailView.module.css'
import { HiveGraph } from '../runs/HiveGraph'
import { ApprovalPanel } from '../views/AgentsView'
import { groupByDossier } from '../runs/dossiers'
import type { Run } from '../runs/types'

/**
 * One dossier's current run, drawn with the same Hive timeline and approval action the
 * internal Agents view uses — reused, not duplicated, since the underlying run/approval
 * mechanism is identical for every brand. Only the surrounding chrome (this file) and the
 * copy (fr.dossierDetail) are Avel's own.
 */
export function DossierDetailView({ runs, dossierId }: { runs: Run[]; dossierId: string | null }) {
  const dossier = dossierId ? groupByDossier(runs).find((d) => d.id === dossierId) : undefined

  if (!dossier) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{fr.dossierDetail.notFound}</p>
        <p className={styles.emptyHint}>{fr.dossierDetail.notFoundHint}</p>
      </div>
    )
  }

  // The most recently updated run is the one worth showing the timeline for — the same
  // choice DossiersView makes for a dossier's status.
  const run = dossier.runs.reduce((latest, r) => (r.updated_at > latest.updated_at ? r : latest))

  return (
    <section>
      <div className={styles.banner}>
        <h2 className={styles.id}>{dossier.id}</h2>
        <span className={styles.graph}>{run.graph}</span>
      </div>

      {run.topology ? (
        <>
          <HiveGraph run={run} runs={runs} />
          <ApprovalPanel run={run} />
        </>
      ) : (
        <p className={styles.noTopology}>
          {run.step === 0 ? fr.hive.topologyPending : fr.hive.noTopology}
        </p>
      )}
    </section>
  )
}
