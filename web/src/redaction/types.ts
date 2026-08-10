/** Mirrors internal/memory.Summary in the Go backend. */
export interface DocumentSummary {
  id: string
  title: string
  word_count: number
  updated_at: string
}

/** Mirrors internal/memory.Suggestion in the Go backend. */
export interface Suggestion {
  id: string
  anchor_start: number
  anchor_end: number
  text: string
  status: 'pending' | 'accepted' | 'ignored'
}

/** Mirrors internal/memory.Document in the Go backend. */
export interface Document extends DocumentSummary {
  body: string
  suggestions: Suggestion[]
}

/** What the browser knows about the document list right now. */
export type DocumentsState =
  | { status: 'loading' }
  | { status: 'ready'; documents: DocumentSummary[] }
  /** No document source configured on kern-ui — distinct from kern-memory answering with none. */
  | { status: 'unconfigured' }
  | { status: 'error' }

/** What the browser knows about one open document right now. */
export type DocumentState =
  | { status: 'loading' }
  | { status: 'ready'; document: Document }
  | { status: 'error' }

/** Same as DocumentState, but nullable: no document is selected yet. */
export type OpenDocumentState = DocumentState | null
