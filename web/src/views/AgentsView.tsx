import { useState } from 'react'
import { fr } from '../i18n/fr'
import { HiveGraph } from '../runs/HiveGraph'
import { RunList } from '../runs/RunList'
import styles from './AgentsView.module.css'
import type { Run } from '../runs/types'

/**
 * The hive of sub-agents: the selected run drawn as a graph, with the run list below acting
 * as the selector.
 *
 * The selection follows the runs when the user has not chosen one — a fresh run should
 * appear without a click — and stays put once they have.
 */
export function AgentsView({ runs }: { runs: Run[] }) {
  const [picked, setPicked] = useState<string | null>(null)
  const selected = runs.find((r) => r.id === picked) ?? runs[0]

  return (
    <section>
      <div className={styles.head}>
        <h2 className={styles.heading}>{fr.runs.heading}</h2>
        {runs.length > 0 && <span className={styles.count}>{fr.runs.count(runs.length)}</span>}
      </div>

      {selected &&
        (selected.topology ? (
          <HiveGraph run={selected} />
        ) : (
          <p className={styles.noTopology}>{fr.hive.noTopology}</p>
        ))}

      <RunList runs={runs} selected={selected?.id} onSelect={setPicked} />
    </section>
  )
}
