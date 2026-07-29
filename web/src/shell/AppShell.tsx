import { useState } from 'react'
import styles from './AppShell.module.css'
import { fr } from '../i18n/fr'
import { ConversationStone } from './ConversationStone'
import { MissingSource } from '../views/MissingSource'
import { AgentsView } from '../views/AgentsView'
import { GrimoireView } from '../grimoire/GrimoireView'
import { useRegistry } from '../grimoire/useRegistry'
import { EspaceView } from '../espace/EspaceView'
import { useTools } from '../espace/useTools'
import { useRunStream } from '../runs/useRunStream'
import { systemState, type SystemState } from './systemState'
import { DEFAULT_VIEW, VIEWS, mobileViews, viewById, type ViewDef, type ViewId } from './views'
import type { Connection, Run } from '../runs/types'

const STREAM_URL = '/api/v1/stream'
const REGISTRY_URL = '/api/v1/registry'
const TOOLS_URL = '/api/v1/tools'

/** Colours come from the mockup's stateMap; tokens.css holds the values. */
const stateColour: Record<SystemState, string> = {
  repos: 'var(--state-idle)',
  reflexion: 'var(--state-thinking)',
  action: 'var(--state-action)',
  erreur: 'var(--state-error)',
}

const connectionColour: Record<Connection, string> = {
  connecting: 'var(--state-thinking)',
  open: 'var(--state-action)',
  error: 'var(--state-error)',
}

export function AppShell({
  user = '',
  onSignOut,
}: {
  /** Empty when the server has no accounts: there is nobody to greet. */
  user?: string
  /** Absent when there is no session to end. */
  onSignOut?: () => void
} = {}) {
  const [view, setView] = useState<ViewId>(DEFAULT_VIEW)
  const { runs, connection } = useRunStream(STREAM_URL)
  const state = systemState(runs)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span
            className={styles.beacon}
            style={{ '--beacon-colour': stateColour[state] } as React.CSSProperties}
            aria-hidden="true"
          />
          <span className={styles.brandName}>{fr.appName}</span>
        </div>

        <nav className={styles.nav} aria-label={fr.nav.primary}>
          {VIEWS.map((v) => (
            <Tab key={v.id} view={v} current={view} onSelect={setView} className={styles.tab}>
              <span className={styles.tabGlyph} aria-hidden="true">
                {v.glyph}
              </span>
              {fr.views[v.id]}
            </Tab>
          ))}
        </nav>

        <div className={styles.status}>
          <p className={styles.statePill} data-testid="system-state">
            <span
              className={styles.dot}
              style={{ '--dot-colour': stateColour[state] } as React.CSSProperties}
              aria-hidden="true"
            />
            {fr.systemState[state]}
          </p>
          {onSignOut && (
            <button type="button" className={styles.signOut} onClick={onSignOut}>
              {user !== '' ? fr.login.signedInAs(user) : fr.login.signOut}
            </button>
          )}
          <p className={styles.connection} role="status">
            <span
              className={styles.dot}
              style={{ '--dot-colour': connectionColour[connection] } as React.CSSProperties}
              aria-hidden="true"
            />
            {fr.connection[connection]}
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <ViewBody view={view} runs={runs} />
      </main>

      {/* Floats over the content and can be tidied against either edge — the mockup's
          rune stone is the handle. */}
      <ConversationStone stateColour={stateColour[state]} />

      <nav className={styles.mobileNav} aria-label={fr.nav.compact}>
        {mobileViews().map((v) => (
          <Tab key={v.id} view={v} current={view} onSelect={setView} className={styles.mobileTab}>
            <span className={styles.mobileGlyph} aria-hidden="true">
              {v.glyph}
            </span>
            {fr.views[v.id]}
          </Tab>
        ))}
      </nav>
    </div>
  )
}

function Tab({
  view,
  current,
  onSelect,
  className,
  children,
}: {
  view: ViewDef
  current: ViewId
  onSelect: (id: ViewId) => void
  className: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      className={className}
      aria-selected={view.id === current}
      onClick={() => onSelect(view.id)}
    >
      {children}
    </button>
  )
}

function ViewBody({ view, runs }: { view: ViewId; runs: Run[] }) {
  const def = viewById(view)

  if (def.source.kind !== 'live') {
    return <MissingSource view={view} source={def.source} />
  }
  if (view === 'grimoire') {
    return <GrimoireBody runs={runs} />
  }
  if (view === 'espace') {
    return <EspaceBody />
  }
  return <AgentsView runs={runs} />
}

/**
 * Wraps the Grimoire so the catalogue is fetched only while the view is open.
 *
 * Keeping the hook here rather than in AppShell means a browser sitting on the Agents view
 * never asks for a registry it is not drawing.
 */
function GrimoireBody({ runs }: { runs: Run[] }) {
  return <GrimoireView registry={useRegistry(REGISTRY_URL)} runs={runs} />
}

/** Same reasoning as GrimoireBody: the catalogue is fetched only while the Espace is open. */
function EspaceBody() {
  return <EspaceView tools={useTools(TOOLS_URL)} />
}
