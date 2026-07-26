import { fr } from '../i18n/fr'
import styles from './RunList.module.css'
import type { Run } from './types'

/** Status colours come from the mockup's stateMap: action is live, idle is at rest. */
const statusColour: Record<Run['status'], string> = {
  running: 'var(--state-action)',
  finished: 'var(--state-idle)',
}

export function RunList({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{fr.runs.empty}</p>
        <p className={styles.emptyHint}>{fr.runs.emptyHint}</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {runs.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </ul>
  )
}

function RunCard({ run }: { run: Run }) {
  const label = fr.runs.status[run.status]

  return (
    <li className={`${styles.card}`} aria-label={`${run.graph} — ${label}`}>
      <div className={styles.head}>
        <h3 className={styles.graph}>{run.graph}</h3>
        <span className={styles.step}>{fr.runs.step(run.step)}</span>
      </div>

      <p className={styles.status}>
        <span
          className={`${styles.dot} ${run.status === 'running' ? styles.dotRunning : ''}`}
          style={{ '--dot-colour': statusColour[run.status] } as React.CSSProperties}
        />
        {label}
      </p>

      {run.frontier.length > 0 ? (
        // Plain spans rather than a nested list: a list inside a list item makes every
        // run announce "list of N" to a screen reader, and blurs the listitem count.
        <p className={styles.frontier} aria-label={fr.runs.frontier}>
          {run.frontier.map((node) => (
            <span key={node} className={styles.node}>
              {node}
            </span>
          ))}
        </p>
      ) : (
        <p className={styles.idle}>{fr.runs.idle}</p>
      )}
    </li>
  )
}
