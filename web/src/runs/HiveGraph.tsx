import { fr } from '../i18n/fr'
import styles from './HiveGraph.module.css'
import { HIVE_WIDTH, layoutHive, nodeStatus } from './hive'
import type { NodeStatus, Run } from './types'

/** The mockup's state palette, applied to nodes rather than to the whole system. */
const statusColour: Record<NodeStatus, string> = {
  pending: 'var(--gold-faint)',
  active: 'var(--state-action)',
  done: 'var(--state-idle)',
  failed: 'var(--state-error)',
}

const RADIUS: Record<string, number> = { agent: 14, subgraph: 13, tool: 10 }

/**
 * Draws a run as the mockup draws it: a hive of nodes, edges flowing on the live paths.
 *
 * Everything here is derived from the declared topology and the frontiers seen so far. When
 * a node's successors are decided at run time the drawing says so with a dashed stub rather
 * than showing a dead end it cannot vouch for.
 */
export function HiveGraph({ run }: { run: Run }) {
  if (!run.topology) return null

  const { nodes, edges, height } = layoutHive(run.topology)
  const statusOf = (id: string) => nodeStatus(run, id)

  return (
    <>
      <ul className={styles.legend}>
        {(['active', 'done', 'pending', 'failed'] as NodeStatus[]).map((s) => (
          <li key={s} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ '--dot-colour': statusColour[s] } as React.CSSProperties}
              aria-hidden="true"
            />
            {fr.hive.status[s]}
          </li>
        ))}
      </ul>

      <svg
        className={styles.frame}
        viewBox={`0 0 ${HIVE_WIDTH} ${height}`}
        role="img"
        aria-label={fr.hive.label(run.graph, nodes.length)}
      >
        {edges.map((e) => {
          // An edge is live when it leads into what is running right now.
          const live = run.status === 'running' && run.frontier.includes(e.to)
          return (
            <line
              key={`${e.from}-${e.to}`}
              className={live ? styles.edgeLive : styles.edge}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
          )
        })}

        {nodes.map((n) => {
          const status = statusOf(n.id)
          const colour = statusColour[status]
          const r = RADIUS[n.kind] ?? 10
          const isEntry = n.id === run.topology!.entry

          return (
            <g key={n.id}>
              {status === 'active' && (
                <circle className={styles.halo} cx={n.x} cy={n.y} r={r} stroke={colour} />
              )}
              <circle cx={n.x} cy={n.y} r={r} fill={colour} />
              {n.openEnded && (
                <path
                  className={styles.openEnded}
                  d={`M ${n.x} ${n.y + r + 4} L ${n.x} ${n.y + r + 26}`}
                />
              )}
              <text
                className={isEntry ? `${styles.label} ${styles.labelEntry}` : styles.label}
                x={n.x}
                y={n.y - r - 10}
                textAnchor="middle"
              >
                {n.id} · {fr.hive.status[status].toLowerCase()}
              </text>
            </g>
          )
        })}
      </svg>
    </>
  )
}
