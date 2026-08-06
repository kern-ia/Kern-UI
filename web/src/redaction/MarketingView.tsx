import { useEffect, useMemo, useRef, useState } from 'react'
import { fr } from '../i18n/fr'
import { contentItemOf, monthGrid, type ContentItem, type ContentStatus } from './marketing'
import styles from './MarketingView.module.css'
import type { Run } from '../runs/types'

const statusColour: Record<ContentStatus, string> = {
  publie: 'var(--state-idle)',
  brouillon: 'var(--gold-faint)',
  refuse: 'var(--state-error)',
  en_cours: 'var(--state-action)',
}

/**
 * The marketing sub-tab of Rédaction: a calendar over the same community-management-agency
 * run data the Agents timeline already draws — not a new backend, not new storage (see
 * marketing.ts). A dateless item never disappears: it lists under "sans date" instead of
 * being silently dropped from a grid it cannot be placed on.
 */
export function MarketingView({ runs }: { runs: Run[] }) {
  const items = useMemo(
    () => runs.map(contentItemOf).filter((i): i is ContentItem => i !== null),
    [runs],
  )
  const [selected, setSelected] = useState<ContentItem | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{fr.marketing.empty}</p>
        <p className={styles.emptyHint}>{fr.marketing.emptyHint}</p>
      </div>
    )
  }

  const cells = monthGrid(year, month, items)
  const unscheduled = items.filter((i) => i.date === null)

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  return (
    <section className={styles.marketing} aria-label={fr.marketing.label}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.navButton} aria-label={fr.marketing.previousMonth} onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <p className={styles.monthLabel}>
          {fr.marketing.months[month]} {year}
        </p>
        <button type="button" className={styles.navButton} aria-label={fr.marketing.nextMonth} onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {fr.marketing.weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cell) => (
          <div key={cell.date.toISOString()} className={styles.cell} data-in-month={cell.inMonth || undefined}>
            <span className={styles.cellDate}>{cell.date.getDate()}</span>
            {cell.items.map((item) => (
              <ItemPill key={item.runId} item={item} onSelect={setSelected} />
            ))}
          </div>
        ))}
      </div>

      {unscheduled.length > 0 && (
        <div className={styles.unscheduled}>
          <p className={styles.unscheduledTitle}>{fr.marketing.unscheduled}</p>
          <p className={styles.unscheduledHint}>{fr.marketing.unscheduledHint}</p>
          <ul className={styles.unscheduledList}>
            {unscheduled.map((item) => (
              <li key={item.runId}>
                <ItemPill item={item} onSelect={setSelected} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && <ItemDetail item={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function ItemPill({ item, onSelect }: { item: ContentItem; onSelect: (i: ContentItem) => void }) {
  return (
    <button
      type="button"
      className={styles.pill}
      style={{ '--dot-colour': statusColour[item.status] } as React.CSSProperties}
      aria-label={fr.marketing.selectItem(item.title)}
      onClick={() => onSelect(item)}
    >
      <span className={styles.pillDot} aria-hidden="true" />
      <span className={styles.pillTitle}>{item.title}</span>
    </button>
  )
}

function ItemDetail({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      ref={ref}
      className={styles.detail}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div className={styles.detailHead}>
        <div>
          <p className={styles.detailTitle}>{item.title}</p>
          <p className={styles.detailMeta}>
            {fr.marketing.status[item.status]} · {fr.marketing.platformLabel} : {item.platform}
          </p>
        </div>
        <button type="button" className={styles.detailClose} aria-label={fr.marketing.closeItem} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.detailBody}>
        {item.text.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  )
}
