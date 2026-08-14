import { useState } from 'react'
import { fr } from '../i18n/fr'
import { layoutCerveau, CANVAS_WIDTH, CANVAS_HEIGHT } from './cerveau'
import styles from './CerveauView.module.css'
import type { CerveauState } from './types'

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25]
const DEFAULT_ZOOM_INDEX = 2

/** Colour per kind, distinct from HiveGraph's status colours — a memory node has no
 * running/done/failed state, only what layer it lives in. */
const kindColour: Record<string, string> = {
  okf: 'var(--gold)',
  vector: 'var(--state-action)',
  graph: 'var(--text-dim)',
}

/**
 * The Cerveau view (C7): a navigable graph of memories. Radial layout (cerveau.ts) —
 * root(s) at the center, each hop its own ring. Double-click a node to dive into its own
 * neighbourhood (kern-ui refetches centered there); a breadcrumb-style back link returns
 * to the broad overview. Zoom follows HiveGraph's own fixed-step convention.
 */
export function CerveauView({
  cerveau,
  focus,
  onDive,
  onBackToOverview,
}: {
  cerveau: CerveauState
  focus: string | null
  onDive: (id: string) => void
  onBackToOverview: () => void
}) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)

  if (cerveau.status === 'loading') {
    return <Notice message={fr.cerveau.loading} />
  }
  if (cerveau.status === 'unconfigured') {
    return <Notice message={fr.cerveau.unconfigured} hint={fr.cerveau.unconfiguredHint} />
  }
  if (cerveau.status === 'error') {
    return <Notice message={fr.cerveau.error} />
  }
  if (cerveau.cerveau.nodes.length === 0) {
    return <Notice message={fr.cerveau.empty} hint={fr.cerveau.emptyHint} />
  }

  const { nodes } = layoutCerveau(cerveau.cerveau)
  const byID = new Map(nodes.map((n) => [n.id, n]))
  const zoom = ZOOM_STEPS[zoomIndex]

  return (
    <section aria-label={fr.cerveau.label}>
      <div className={styles.toolbar}>
        <span className={styles.count}>{fr.cerveau.activeCount(nodes.length)}</span>
        <div className={styles.toolbarRight}>
          {focus && (
            <button type="button" className={styles.back} onClick={onBackToOverview}>
              {fr.cerveau.backToOverview}
            </button>
          )}
          <div className={styles.zoom}>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label={fr.hive.zoomOut}
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            >
              −
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label={fr.hive.zoomIn}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className={styles.scroller}>
        <svg
          className={styles.frame}
          style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <g className={styles.edges}>
            {cerveau.cerveau.edges.map((e, i) => {
              const from = byID.get(e.from)
              const to = byID.get(e.to)
              if (!from || !to) return null
              return <line key={i} className={styles.edge} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            })}
          </g>
          {nodes.map((node) => (
            <g
              key={node.id}
              className={styles.node}
              transform={`translate(${node.x}, ${node.y})`}
              tabIndex={0}
              role="button"
              aria-label={fr.cerveau.diveInto(node.label)}
              onDoubleClick={() => onDive(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDive(node.id)
              }}
            >
              <circle
                r={node.hop === 0 ? 16 : 10}
                style={{ '--node-colour': kindColour[node.kind] ?? 'var(--text-dim)' } as React.CSSProperties}
                className={styles.nodeCircle}
              />
              <text className={styles.nodeLabel} y={node.hop === 0 ? -24 : -16} textAnchor="middle">
                {truncate(node.label)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className={styles.hint}>{fr.cerveau.hint}</p>
    </section>
  )
}

function truncate(label: string): string {
  return label.length > 28 ? label.slice(0, 27) + '…' : label
}

function Notice({ message, hint }: { message: string; hint?: string }) {
  return (
    <section className={styles.notice}>
      <p className={styles.noticeMessage}>{message}</p>
      {hint && <p className={styles.noticeHint}>{hint}</p>}
    </section>
  )
}
