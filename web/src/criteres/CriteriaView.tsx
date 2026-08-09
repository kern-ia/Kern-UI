import { fr } from '../i18n/fr'
import styles from './CriteriaView.module.css'
import type { CriteriaState } from './types'

export function CriteriaView({ criteria }: { criteria: CriteriaState }) {
  if (criteria.status === 'loading') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.criteria.loading}</p>
      </div>
    )
  }
  if (criteria.status === 'unconfigured') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.criteria.unconfigured}</p>
        <p className={styles.noticeHint}>{fr.criteria.unconfiguredHint}</p>
      </div>
    )
  }
  if (criteria.status === 'error') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.criteria.error}</p>
      </div>
    )
  }
  if (criteria.criteria.length === 0) {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.criteria.empty}</p>
        <p className={styles.noticeHint}>{fr.criteria.emptyHint}</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className={styles.heading}>{fr.criteria.label}</h2>
      <ul className={styles.list}>
        {criteria.criteria.map((c) => (
          <li key={c.memory.id} className={styles.card}>
            <p className={styles.text}>{c.memory.text}</p>
            {c.memory.tags && c.memory.tags.length > 0 && (
              <p className={styles.tags}>
                {c.memory.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
