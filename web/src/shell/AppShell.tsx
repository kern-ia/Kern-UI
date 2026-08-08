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
import { VigieView } from '../vigie/VigieView'
import { useBudget } from '../vigie/useBudget'
import { useDecisions } from '../vigie/useDecisions'
import { RedactionView } from '../redaction/RedactionView'
import { useDocuments } from '../redaction/useDocuments'
import { useDocument } from '../redaction/useDocument'
import { MarketingView } from '../redaction/MarketingView'
import { useRunStream } from '../runs/useRunStream'
import { topLevelRuns } from '../runs/nested'
import { systemState, type SystemState } from './systemState'
import { activeViews, defaultView, mobileViews, viewById, type ViewDef, type ViewId } from './views'
import { DossiersView } from '../dossiers/DossiersView'
import { DossierDetailView } from '../dossiers/DossierDetailView'
import type { Connection, Run } from '../runs/types'

const STREAM_URL = '/api/v1/stream'
const REGISTRY_URL = '/api/v1/registry'
const TOOLS_URL = '/api/v1/tools'
const DOCUMENTS_URL = '/api/v1/documents'
const VIGIE_BUDGET_URL = '/api/v1/vigie/budget'
const VIGIE_DECISIONS_URL = '/api/v1/vigie/decisions'

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
  const [view, setView] = useState<ViewId>(defaultView())
  const { runs, connection } = useRunStream(STREAM_URL)
  const state = systemState(runs)

  // Lifted out of the Agents view so the conversation stone can nudge whichever mission is
  // open, on any tab — not only while the Agents view itself is on screen.
  const [pickedRunId, setPickedRunId] = useState<string | null>(null)
  const listedRuns = topLevelRuns(runs)
  const selectedRun = listedRuns.find((r) => r.id === pickedRunId) ?? listedRuns[0] ?? null

  // Avel's Dossiers -> Suivi navigation: picking a dossier switches the tab, the same way
  // clicking a mission elsewhere never needs its own routing.
  const [pickedDossierId, setPickedDossierId] = useState<string | null>(null)
  const openDossier = (id: string) => {
    setPickedDossierId(id)
    setView('suivi')
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span
            className={styles.beacon}
            style={{ '--beacon-colour': stateColour[state] } as React.CSSProperties}
            aria-hidden="true"
          />
          <span className={styles.brandName}>{fr.appName}</span>
          <span className={styles.brandSep} aria-hidden="true">
            /
          </span>
          <span className={styles.brandContext}>{fr.views[view]}</span>
        </div>

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

      <div className={styles.body}>
        <nav className={styles.sidebar} aria-label={fr.nav.primary}>
          {activeViews().map((v) => (
            <Tab key={v.id} view={v} current={view} onSelect={setView} className={styles.navItem}>
              <span className={styles.navGlyph} aria-hidden="true">
                {v.glyph}
              </span>
              {fr.views[v.id]}
            </Tab>
          ))}
        </nav>

        <main className={styles.main}>
          <ViewBody
            view={view}
            runs={runs}
            user={user}
            selectedId={selectedRun?.id ?? null}
            onSelect={setPickedRunId}
            dossierId={pickedDossierId}
            onSelectDossier={openDossier}
          />

          {/* Floats over the content and can be tidied against either edge — the
              mockup's rune stone is the handle. Mounted inside .main (not the whole
              shell) so "dock left" means the edge of the content pane, not past the
              sidebar. */}
          <ConversationStone stateColour={stateColour[state]} selectedRun={selectedRun} />
        </main>
      </div>

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

function ViewBody({
  view,
  runs,
  user,
  selectedId,
  onSelect,
  dossierId,
  onSelectDossier,
}: {
  view: ViewId
  runs: Run[]
  user: string
  selectedId: string | null
  onSelect: (id: string) => void
  dossierId: string | null
  onSelectDossier: (id: string) => void
}) {
  const def = viewById(view)

  if (def.source.kind !== 'live') {
    return <MissingSource view={view} source={def.source} />
  }
  if (view === 'dossiers') {
    return <DossiersView runs={runs} onSelect={onSelectDossier} />
  }
  if (view === 'suivi') {
    return <DossierDetailView runs={runs} dossierId={dossierId} />
  }
  if (view === 'automatisations') {
    return <GrimoireBody runs={runs} />
  }
  if (view === 'grimoire') {
    return <GrimoireBody runs={runs} />
  }
  if (view === 'espace') {
    return <EspaceBody />
  }
  if (view === 'vigie') {
    return <VigieBody />
  }
  if (view === 'redaction') {
    return <RedactionBody runs={runs} />
  }
  return <AgentsView runs={runs} user={user} selectedId={selectedId} onSelect={onSelect} />
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

/**
 * Same reasoning as EspaceBody: the budget snapshot is fetched, and the decision stream
 * subscribed to, only while Vigie is open — a browser sitting on another view holds neither
 * a polling timer nor an EventSource it is not drawing.
 */
function VigieBody() {
  const budget = useBudget(VIGIE_BUDGET_URL)
  const feed = useDecisions(VIGIE_DECISIONS_URL)
  return <VigieView budget={budget} feed={feed} />
}

type RedactionTab = 'memoire' | 'marketing'

/**
 * Wraps Rédaction: a sub-tab between the document editor (Mémoire, kern-memory-backed)
 * and the comm content calendar (Marketing, read from the same run data the Agents
 * timeline already draws — see redaction/marketing.ts). Two unrelated capabilities
 * sharing one nav entry, kept apart here rather than one component doing both jobs.
 */
function RedactionBody({ runs }: { runs: Run[] }) {
  const [tab, setTab] = useState<RedactionTab>('memoire')

  return (
    <div className={styles.redactionBody}>
      <div role="tablist" className={styles.redactionTabs}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'memoire'}
          className={styles.redactionTab}
          onClick={() => setTab('memoire')}
        >
          {fr.redaction.tabs.memoire}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'marketing'}
          className={styles.redactionTab}
          onClick={() => setTab('marketing')}
        >
          {fr.redaction.tabs.marketing}
        </button>
      </div>
      {tab === 'memoire' ? <MemoireBody /> : <MarketingView runs={runs} />}
    </div>
  )
}

/**
 * The document list is fetched only while Mémoire is open, the selected document only
 * once one is picked (defaulting to the first once the list arrives).
 */
function MemoireBody() {
  const documents = useDocuments(DOCUMENTS_URL)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const openId =
    selectedId ?? (documents.status === 'ready' ? (documents.documents[0]?.id ?? null) : null)
  const [document, refetchDocument] = useDocument(DOCUMENTS_URL, openId)

  return (
    <RedactionView
      documents={documents}
      document={openId === null ? null : document}
      onSelect={setSelectedId}
      onResolved={refetchDocument}
    />
  )
}
