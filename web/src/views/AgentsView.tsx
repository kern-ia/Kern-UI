import { useState } from 'react'
import { fr } from '../i18n/fr'
import { HiveGraph } from '../runs/HiveGraph'
import { RunList } from '../runs/RunList'
import styles from './AgentsView.module.css'
import { topLevelRuns } from '../runs/nested'
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

  // Nested runs are drawn inside the node that produced them, so listing them beside their
  // parent would show the same work twice.
  const listed = topLevelRuns(runs)
  const selected = listed.find((r) => r.id === picked) ?? listed[0]

  return (
    <section>
      <div className={styles.head}>
        <h2 className={styles.heading}>{fr.runs.heading}</h2>
        {listed.length > 0 && <span className={styles.count}>{fr.runs.count(listed.length)}</span>}
      </div>

      {selected &&
        (selected.topology ? (
          <HiveGraph run={selected} runs={runs} />
        ) : (
          // A run that has completed no level yet was opened by its activity signal: its
          // shape is still on its way. Only past that point is a missing topology a
          // statement about the producer rather than about timing.
          <p className={styles.noTopology}>
            {selected.step === 0 ? fr.hive.topologyPending : fr.hive.noTopology}
          </p>
        ))}

      <RunList runs={listed} selected={selected?.id} onSelect={setPicked} />
    </section>
  )
}
