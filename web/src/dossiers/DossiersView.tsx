import { fr } from '../i18n/fr'
import styles from './DossiersView.module.css'
import { groupByDossier, type Dossier } from '../runs/dossiers'
import type { Run } from '../runs/types'

/** Status colours, same source as RunList's own — the mockup's stateMap, via tokens.css. */
const statusColour: Record<Run['status'], string> = {
  running: 'var(--state-action)',
  finished: 'var(--state-idle)',
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
      <ul className={styles.list}>
        {dossiers.map((dossier) => (
          <DossierCard key={dossier.id} dossier={dossier} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}

function DossierCard({ dossier, onSelect }: { dossier: Dossier; onSelect?: (id: string) => void }) {
  const run = latestRun(dossier)
  const label = fr.runs.status[run.status]

  return (
    <li className={styles.card}>
      <button
        type="button"
        className={styles.pick}
        aria-label={fr.dossiers.open(dossier.id)}
        onClick={() => onSelect?.(dossier.id)}
      >
        <h3 className={styles.id}>{dossier.id}</h3>
        <p className={styles.status}>
          <span
            className={styles.dot}
            style={{ '--dot-colour': statusColour[run.status] } as React.CSSProperties}
          />
          {label} — {run.graph}
        </p>
      </button>
    </li>
  )
}
