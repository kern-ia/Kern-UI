import { fr } from '../i18n/fr'
import { viewById, type ViewId, type ViewSource } from '../shell/views'
import styles from './MissingSource.module.css'

/**
 * Stands in for a view whose data has no producer yet.
 *
 * It deliberately renders no data — not a skeleton, not a sample, not a chart with made-up
 * numbers. A screen that looks populated teaches the reader something false about the state
 * of the system. Saying "this waits for kern-memory" is worth more than a convincing lie.
 */
export function MissingSource({ view, source }: { view: ViewId; source: ViewSource }) {
  const reason =
    source.kind === 'no-contract' ? fr.missing.noContract(source.brick) : fr.missing.noBrick

  return (
    <section className={styles.panel}>
      <span className={styles.glyph} aria-hidden="true">
        {viewById(view).glyph}
      </span>
      <h2 className={styles.title}>{fr.views[view]}</h2>
      <p className={styles.reason}>{reason}</p>
      {source.kind === 'no-contract' && source.detail && (
        <p className={styles.reason}>{fr.missing.detail[source.detail]}</p>
      )}
      <p className={styles.why}>{fr.missing.why}</p>
      <p className={styles.roadmap}>{fr.missing.roadmap}</p>
    </section>
  )
}
