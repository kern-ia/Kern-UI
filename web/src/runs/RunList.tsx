import { fr } from '../i18n/fr'
import styles from './RunList.module.css'
import type { Run } from './types'

/** Status colours come from the mockup's stateMap: action is live, idle is at rest. */
const statusColour: Record<Run['status'], string> = {
  running: 'var(--state-action)',
  finished: 'var(--state-idle)',
  failed: 'var(--state-error)',
}

interface RunListProps {
  runs: Run[]
  selected?: string
  onSelect?: (id: string) => void
}

export function RunList({ runs, selected, onSelect }: RunListProps) {
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
        <RunCard
          key={run.id}
          run={run}
          selected={run.id === selected}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

function RunCard({
  run,
  selected,
  onSelect,
}: {
  run: Run
  selected: boolean
  onSelect?: (id: string) => void
}) {
  const label = fr.runs.status[run.status]

  const body = (
    <>
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
    </>
  )

  return (
    <li className={styles.card} data-selected={selected} aria-label={`${run.graph} — ${label}`}>
      {onSelect ? (
        <button
          type="button"
          className={styles.pick}
          aria-pressed={selected}
          aria-label={fr.runs.select(run.graph)}
          onClick={() => onSelect(run.id)}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  )
}
