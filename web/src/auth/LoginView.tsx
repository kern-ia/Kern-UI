import { useState, type FormEvent } from 'react'
import { fr } from '../i18n/fr'
import styles from './LoginView.module.css'
import type { Credentials } from './session'

/**
 * The way in.
 *
 * It says one thing when it refuses, whatever went wrong. The server does not tell us
 * whether the account exists, on purpose — a page that answers "unknown account" faster
 * than "wrong password" is a way to find out who works here. Repeating that discipline on
 * screen costs nothing and keeps the two ends honest together.
 */
export function LoginView({
  onSignIn,
  unreachable = false,
}: {
  onSignIn: (c: Credentials) => Promise<boolean>
  /** The server did not answer at all. Different from a refusal, and said differently. */
  unreachable?: boolean
}) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [refused, setRefused] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === '' || password === '' || submitting) return

    setSubmitting(true)
    setRefused(false)
    const accepted = await onSignIn({ name: name.trim(), password })
    setSubmitting(false)
    if (!accepted) {
      setRefused(true)
      setPassword('')
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <span className={styles.glyph} aria-hidden="true">
          ᛝ
        </span>
        <h1 className={styles.title}>{fr.login.title}</h1>
        <p className={styles.subtitle}>{fr.login.subtitle}</p>

        <label className={styles.field}>
          <span className={styles.label}>{fr.login.name}</span>
          <input
            className={styles.input}
            type="text"
            value={name}
            autoComplete="username"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{fr.login.password}</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {(refused || unreachable) && (
          <p className={styles.refused} role="alert">
            {unreachable ? fr.login.unreachable : fr.login.refused}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? fr.login.submitting : fr.login.submit}
        </button>
      </form>
    </main>
  )
}
