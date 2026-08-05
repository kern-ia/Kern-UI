import { fr } from '../i18n/fr'
import type { Connection } from '../runs/types'
import styles from './VigieView.module.css'
import type { Budget, BudgetState, Decision } from './types'

interface DecisionFeed {
  decisions: Decision[]
  connection: Connection
}

/**
 * Vigie: the consumption gauge and the live behavioural feed, side by side — a control
 * tower over what the connected agents are spending and doing, not steering either.
 *
 * Two independent data sources drive this view (see useBudget and useDecisions), each with
 * its own failure mode: the gauge can be loading/unconfigured/error/ready on its own
 * schedule, and the feed's connection can drop and recover independently of whether the
 * gauge ever loaded. `budget`'s status gates the whole view — a firewall answering nothing
 * for the gauge almost certainly means it will answer nothing for the feed either, since
 * both come from the same unconfigured source — while the feed's own connection indicator
 * stays visible once the view renders, since only the feed reconnects on its own.
 */
export function VigieView({ budget, feed }: { budget: BudgetState; feed: DecisionFeed }) {
  if (budget.status === 'loading') {
    return <Notice message={fr.vigie.loading} />
  }
  if (budget.status === 'unconfigured') {
    return <Notice message={fr.vigie.unconfigured} hint={fr.vigie.unconfiguredHint} />
  }
  if (budget.status === 'error') {
    return <Notice message={fr.vigie.error} />
  }

  return (
    <section className={styles.vigie} aria-label={fr.vigie.label}>
      <BudgetTile budget={budget.budget} />
      <DecisionFeedPanel decisions={feed.decisions} connection={feed.connection} />
    </section>
  )
}

function BudgetTile({ budget }: { budget: Budget }) {
  const spentFraction = budget.limit_micros > 0 ? Math.min(1, budget.spent_micros / budget.limit_micros) : 0
  const resetsAt = formatRelativeFuture(budget.window_resets_at)

  return (
    <article className={styles.card} aria-label={fr.vigie.budget.heading}>
      <h3 className={styles.heading}>{fr.vigie.budget.heading}</h3>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ '--fraction': spentFraction } as React.CSSProperties} />
      </div>
      <div className={styles.spentLine}>
        <span>{fr.vigie.budget.spent}</span>
        <span className={styles.spentValue}>{formatMicros(budget.spent_micros)}</span>
        <span className={styles.limitValue}>
          {fr.vigie.budget.limit} {formatMicros(budget.limit_micros)}
        </span>
      </div>
      <dl className={styles.counters}>
        <div className={styles.counter}>
          <dt>{fr.vigie.budget.unpriced}</dt>
          <dd>{budget.unpriced_calls}</dd>
        </div>
        <div className={styles.counter}>
          <dt>{fr.vigie.budget.unaccounted}</dt>
          <dd>{budget.unaccounted_calls}</dd>
        </div>
      </dl>
      {resetsAt && <p className={styles.resets}>{fr.vigie.budget.resetsAt(resetsAt)}</p>}
    </article>
  )
}

function DecisionFeedPanel({ decisions, connection }: { decisions: Decision[]; connection: Connection }) {
  return (
    <article className={styles.card} aria-label={fr.vigie.decisions.heading}>
      <div className={styles.feedHeader}>
        <h3 className={styles.heading}>{fr.vigie.decisions.heading}</h3>
        <span className={styles.connection}>{fr.connection[connection]}</span>
      </div>
      {decisions.length === 0 ? (
        <Notice message={fr.vigie.decisions.empty} hint={fr.vigie.decisions.emptyHint} compact />
      ) : (
        <ul className={styles.feed}>
          {decisions.map((d, i) => (
            <li key={`${d.run_id}-${d.rule}-${d.at}-${i}`} className={styles.feedItem}>
              <span className={styles.rule}>{d.rule}</span>
              <span className={styles.runId}>{d.run_id}</span>
              <span className={styles.at}>{d.at}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Notice({ message, hint, compact }: { message: string; hint?: string; compact?: boolean }) {
  return (
    <section className={compact ? styles.noticeCompact : styles.notice}>
      {!compact && (
        <span className={styles.noticeGlyph} aria-hidden="true">
          ◉
        </span>
      )}
      <p className={styles.noticeMessage}>{message}</p>
      {hint && <p className={styles.noticeHint}>{hint}</p>}
    </section>
  )
}

/** 18000 → "0,018 $" — micros are an accounting detail, not something to show raw. */
function formatMicros(micros: number): string {
  return (micros / 1_000_000).toLocaleString('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 })
}

/** Returns "dans 2 h" or similar, or undefined for an unparsable timestamp. */
function formatRelativeFuture(iso: string): string | undefined {
  const target = Date.parse(iso)
  if (Number.isNaN(target)) return undefined
  const diffMs = target - Date.now()
  if (diffMs <= 0) return undefined
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return `dans ${minutes} min`
  const hours = Math.round(minutes / 60)
  return `dans ${hours} h`
}
