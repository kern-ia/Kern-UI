import { useCallback, useEffect, useState } from 'react'
import type { Credentials, SessionState } from './session'

const SESSION_URL = '/api/v1/session'
const LOGIN_URL = '/api/v1/login'
const LOGOUT_URL = '/api/v1/logout'

/**
 * Who the browser is, and how to become somebody.
 *
 * The session travels in a cookie the server sets and JavaScript cannot read, so this hook
 * never handles a token: it asks the server who it thinks we are. That is also why signing
 * out is a request rather than a local reset — dropping the cookie here would leave the
 * session open on the server for anyone holding a copy of it.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(SESSION_URL)
      if (response.status === 401) {
        setState({ status: 'anonymous' })
        return
      }
      if (!response.ok) {
        setState({ status: 'error' })
        return
      }
      const body = (await response.json()) as { name?: string }
      setState({ status: 'signed-in', name: body.name ?? '' })
    } catch {
      // An unreachable server is not a locked one. Showing a login form here would invite
      // someone to type a password into a page that cannot check it.
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (credentials: Credentials): Promise<boolean> => {
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!response.ok) return false

      const body = (await response.json()) as { name?: string }
      setState({ status: 'signed-in', name: body.name ?? credentials.name })
      return true
    } catch {
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fetch(LOGOUT_URL, { method: 'POST' })
    } finally {
      // Whatever the server answered, this browser is done with the session.
      setState({ status: 'anonymous' })
    }
  }, [])

  return { state, signIn, signOut }
}
