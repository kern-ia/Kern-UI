import { fr } from '../i18n/fr'
import { viewById, type ViewId, type ViewSource } from '../shell/views'
import styles from './MissingSource.module.css'

/**
 * Stands in for a view whose data has no producer yet.
 *
 * It deliberately renders no data — not a skeleton, not a sample, not a chart with made-up
 * numbers. A screen that looks populated teaches the reader something false about the state
 * of the system. Saying what is missing is worth more than a convincing lie.
 *
 * What it says is the capability, never the module: whoever reads this wanted to consult a
 * memory or drive a browser. `kern-memory` is our word for it, and it explains nothing to
 * them while exposing how we are built.
 */
export function MissingSource({ view, source }: { view: ViewId; source: ViewSource }) {
  if (source.kind === 'live') return null

  return (
    <section className={styles.panel}>
      <span className={styles.glyph} aria-hidden="true">
        {viewById(view).glyph}
      </span>
      <h2 className={styles.title}>{fr.views[view]}</h2>
      <p className={styles.reason}>{fr.missing.awaiting[source.capability]}</p>
      <p className={styles.why}>{fr.missing.why}</p>
    </section>
  )
}
