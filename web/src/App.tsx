import styles from './App.module.css'
import { fr } from './i18n/fr'
import { RunList } from './runs/RunList'
import { useRunStream } from './runs/useRunStream'
import type { Connection } from './runs/types'

const STREAM_URL = '/api/v1/stream'

const connectionColour: Record<Connection, string> = {
  connecting: 'var(--state-thinking)',
  open: 'var(--state-action)',
  error: 'var(--state-error)',
}

export default function App() {
  const { runs, connection } = useRunStream(STREAM_URL)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.beacon} aria-hidden="true" />
          <span className={styles.brandName}>{fr.appName}</span>
        </div>

        <p className={styles.connection} role="status">
          <span
            className={styles.connectionDot}
            style={{ '--dot-colour': connectionColour[connection] } as React.CSSProperties}
            aria-hidden="true"
          />
          {fr.connection[connection]}
        </p>
      </header>

      <main className={styles.main}>
        <div className={styles.sectionHead}>
          <h2 className={styles.heading}>{fr.runs.heading}</h2>
          {runs.length > 0 && <span className={styles.count}>{fr.runs.count(runs.length)}</span>}
        </div>

        <RunList runs={runs} />
      </main>
    </div>
  )
}
