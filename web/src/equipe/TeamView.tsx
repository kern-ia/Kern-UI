import { fr } from '../i18n/fr'
import styles from './TeamView.module.css'
import { initials } from '../shell/initials'
import type { TeamState } from './useTeam'

export function TeamView({ team }: { team: TeamState }) {
  if (team.status === 'loading') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.team.loading}</p>
      </div>
    )
  }
  if (team.status === 'error') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.team.error}</p>
      </div>
    )
  }
  if (team.names.length === 0) {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeMessage}>{fr.team.empty}</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className={styles.heading}>{fr.team.label}</h2>
      <ul className={styles.list}>
        {team.names.map((name) => (
          <li key={name} className={styles.card}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(name)}
            </span>
            <span className={styles.name}>{name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
