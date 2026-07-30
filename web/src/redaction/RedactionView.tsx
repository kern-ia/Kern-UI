import { useState } from 'react'
import { fr } from '../i18n/fr'
import { resolveSuggestion } from './api'
import { relativeUpdate } from './relativeTime'
import styles from './RedactionView.module.css'
import type { DocumentsState, DocumentSummary, OpenDocumentState, Suggestion } from './types'

/**
 * Rédaction: a sidebar of documents, and the open one's body with its pending suggestions —
 * after design/mockups/Agentic OS.dc.html's `isWrite` block. V1 is read + accept/ignore
 * only: no typing, no autosave, matching the session's scope decision.
 */
export function RedactionView({
  documents,
  document,
  onSelect,
  onResolved,
}: {
  documents: DocumentsState
  /** The open document, or its loading/error state — null while nothing is selected yet. */
  document: OpenDocumentState
  onSelect: (id: string) => void
  /** Called after a suggestion is resolved, so the caller can refetch the open document. */
  onResolved: () => void
}) {
  if (documents.status === 'loading') {
    return <Notice message={fr.redaction.loading} />
  }
  if (documents.status === 'unconfigured') {
    return <Notice message={fr.redaction.unconfigured} hint={fr.redaction.unconfiguredHint} />
  }
  if (documents.status === 'error') {
    return <Notice message={fr.redaction.error} />
  }
  if (documents.documents.length === 0) {
    return <Notice message={fr.redaction.empty} />
  }

  return (
    <section className={styles.redaction} aria-label={fr.redaction.label}>
      <Sidebar documents={documents.documents} selected={document} onSelect={onSelect} />
      <MainPanel document={document} onResolved={onResolved} />
    </section>
  )
}

function Sidebar({
  documents,
  selected,
  onSelect,
}: {
  documents: DocumentSummary[]
  selected: OpenDocumentState
  onSelect: (id: string) => void
}) {
  const selectedId = selected && selected.status === 'ready' ? selected.document.id : null

  return (
    <ul className={styles.sidebar}>
      {documents.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            className={styles.sidebarItem}
            aria-pressed={doc.id === selectedId}
            data-selected={doc.id === selectedId}
            onClick={() => onSelect(doc.id)}
          >
            <span className={styles.sidebarGlyph} aria-hidden="true">
              ◈
            </span>
            <span className={styles.sidebarTitle}>{doc.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function MainPanel({
  document,
  onResolved,
}: {
  document: OpenDocumentState
  onResolved: () => void
}) {
  if (document === null || document.status === 'loading') {
    return <div className={styles.main} />
  }
  if (document.status === 'error') {
    return (
      <div className={styles.main}>
        <p className={styles.documentError}>{fr.redaction.documentError}</p>
      </div>
    )
  }

  const doc = document.document
  const pending = doc.suggestions.filter((s) => s.status === 'pending')

  return (
    <div className={styles.main}>
      <h2 className={styles.title}>{doc.title}</h2>
      <p className={styles.meta}>
        {fr.redaction.wordCount(doc.word_count)} · {fr.redaction.updated(relativeUpdate(doc.updated_at))}
      </p>
      <Body body={doc.body} suggestions={doc.suggestions} />
      {pending.map((sg) => (
        <SuggestionCard
          key={sg.id}
          documentId={doc.id}
          suggestion={sg}
          anchorText={doc.body.slice(sg.anchor_start, sg.anchor_end)}
          onResolved={onResolved}
        />
      ))}
    </div>
  )
}

/** Splits the plain-text body around each suggestion's anchor, highlighting the span. */
function Body({ body, suggestions }: { body: string; suggestions: Suggestion[] }) {
  const anchors = suggestions
    .filter((s) => s.status === 'pending')
    .slice()
    .sort((a, b) => a.anchor_start - b.anchor_start)

  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const sg of anchors) {
    if (sg.anchor_start < cursor || sg.anchor_end > body.length) continue
    parts.push(body.slice(cursor, sg.anchor_start))
    parts.push(
      <span key={sg.id} className={styles.anchor}>
        {body.slice(sg.anchor_start, sg.anchor_end)}
      </span>,
    )
    cursor = sg.anchor_end
  }
  parts.push(body.slice(cursor))

  return <p className={styles.body}>{parts}</p>
}

function SuggestionCard({
  documentId,
  suggestion,
  anchorText,
  onResolved,
}: {
  documentId: string
  suggestion: Suggestion
  anchorText: string
  onResolved: () => void
}) {
  const [resolving, setResolving] = useState(false)
  const [failed, setFailed] = useState(false)

  const resolve = async (accept: boolean) => {
    setResolving(true)
    setFailed(false)
    try {
      await resolveSuggestion(documentId, suggestion.id, accept)
      onResolved()
    } catch {
      setFailed(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className={styles.suggestion}>
      <p className={styles.suggestionTitle}>{fr.redaction.suggestion(anchorText || suggestion.text)}</p>
      <p className={styles.suggestionText}>{suggestion.text}</p>
      <div className={styles.suggestionActions}>
        <button type="button" disabled={resolving} onClick={() => resolve(true)}>
          {resolving ? fr.redaction.resolving : fr.redaction.accept}
        </button>
        <button type="button" disabled={resolving} onClick={() => resolve(false)}>
          {resolving ? fr.redaction.resolving : fr.redaction.ignore}
        </button>
      </div>
      {failed && <p className={styles.suggestionError}>{fr.redaction.resolveFailed}</p>}
    </div>
  )
}

function Notice({ message, hint }: { message: string; hint?: string }) {
  return (
    <section className={styles.notice}>
      <span className={styles.noticeGlyph} aria-hidden="true">
        ✎
      </span>
      <p className={styles.noticeMessage}>{message}</p>
      {hint && <p className={styles.noticeHint}>{hint}</p>}
    </section>
  )
}
