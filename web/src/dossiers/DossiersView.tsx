import { fr } from '../i18n/fr'
import styles from './DossiersView.module.css'
import { currentNodeId, dossierStatus, groupByDossier, type Dossier, type DossierStatus } from '../runs/dossiers'
import { relativeUpdate } from '../redaction/relativeTime'
import type { Run } from '../runs/types'

/** Business-status colours — matches the mockup's own four-word vocabulary, not the
 * technical repos/réflexion/action/erreur state set used elsewhere in the shell. */
const statusColour: Record<DossierStatus, string> = {
  waiting: 'var(--state-idle)',
  active: 'var(--state-action)',
  done: 'var(--state-done)',
  failed: 'var(--state-error)',
}

/** A dossier's status is its most recently updated run's — the one still worth watching. */
function latestRun(dossier: Dossier): Run {
  return dossier.runs.reduce((latest, run) => (run.updated_at > latest.updated_at ? run : latest))
}

export function DossiersView({
  runs,
  onSelect,
}: {
  runs: Run[]
  onSelect?: (dossierId: string) => void
}) {
  const dossiers = groupByDossier(runs)

  if (dossiers.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{fr.dossiers.empty}</p>
        <p className={styles.emptyHint}>{fr.dossiers.emptyHint}</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className={styles.heading}>{fr.dossiers.label}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{fr.dossiers.columns.id}</th>
              <th scope="col">{fr.dossiers.columns.step}</th>
              <th scope="col">{fr.dossiers.columns.status}</th>
              <th scope="col">{fr.dossiers.columns.updated}</th>
              <th scope="col">
                <span className={styles.srOnly}>{fr.dossiers.label}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier) => (
              <DossierRow key={dossier.id} dossier={dossier} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DossierRow({ dossier, onSelect }: { dossier: Dossier; onSelect?: (id: string) => void }) {
  const run = latestRun(dossier)
  const status = dossierStatus(run)
  const nodeId = currentNodeId(run)
  const step = nodeId ? fr.hive.nodeInfo(nodeId).name : run.graph

  return (
    <tr>
      <th scope="row" className={styles.id}>
        {dossier.id}
      </th>
      <td className={styles.step}>{step}</td>
      <td>
        <span className={styles.status}>
          <span
            className={styles.dot}
            style={{ '--dot-colour': statusColour[status] } as React.CSSProperties}
          />
          {fr.dossiers.status[status]}
        </span>
      </td>
      <td className={styles.since}>{fr.dossiers.updated(relativeUpdate(run.updated_at))}</td>
      <td>
        {status === 'waiting' ? (
          <button type="button" className={styles.treat} onClick={() => onSelect?.(dossier.id)}>
            {fr.dossiers.treat(dossier.id)}
          </button>
        ) : (
          <button type="button" className={styles.open} onClick={() => onSelect?.(dossier.id)}>
            {fr.dossiers.open(dossier.id)}
          </button>
        )}
      </td>
    </tr>
  )
}
