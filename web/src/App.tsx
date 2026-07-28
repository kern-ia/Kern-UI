import { AppShell } from './shell/AppShell'
import { LoginView } from './auth/LoginView'
import { useSession } from './auth/useSession'

/**
 * Decides whether to show the interface or the way in.
 *
 * Four states rather than two, because "we do not know yet" and "the server is unreachable"
 * are not the same as "log in". Drawing a login form while the server is down would invite
 * someone to type a password into a page that cannot check it.
 */
export default function App() {
  const { state, signIn, signOut } = useSession()

  switch (state.status) {
    case 'loading':
      return null
    case 'anonymous':
      return <LoginView onSignIn={signIn} />
    case 'error':
      return <LoginView onSignIn={signIn} unreachable />
    case 'signed-in':
      return <AppShell user={state.name} onSignOut={state.name === '' ? undefined : signOut} />
  }
}
