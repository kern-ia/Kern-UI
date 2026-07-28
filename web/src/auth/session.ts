/** Who is looking at the interface, as far as the browser knows. */
export type SessionState =
  | { status: 'loading' }
  /** Nobody is logged in and somebody must be: the login screen. */
  | { status: 'anonymous' }
  /**
   * Signed in — or the server has no accounts configured, in which case `name` is empty and
   * there is nobody to be. Both draw the interface; only one has somebody to greet.
   */
  | { status: 'signed-in'; name: string }
  | { status: 'error' }

export interface Credentials {
  name: string
  password: string
}
