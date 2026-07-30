import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RedactionView } from './RedactionView'
import { fr } from '../i18n/fr'
import type { Document, DocumentsState } from './types'

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const summaries: DocumentsState = {
  status: 'ready',
  documents: [{ id: 'doc1', title: 'Compte-rendu', word_count: 20, updated_at: '2026-07-30T10:00:00Z' }],
}

const doc: Document = {
  id: 'doc1',
  title: 'Compte-rendu',
  body: 'Il faudrait preciser la transition ici.',
  word_count: 6,
  updated_at: '2026-07-30T10:00:00Z',
  suggestions: [
    { id: 's1', anchor_start: 13, anchor_end: 35, text: 'Préciser la transition.', status: 'pending' },
  ],
}

it('says what is missing when no document source is configured', () => {
  render(
    <RedactionView documents={{ status: 'unconfigured' }} document={null} onSelect={vi.fn()} onResolved={vi.fn()} />,
  )
  expect(screen.getByText(fr.redaction.unconfigured)).toBeInTheDocument()
})

it('says the catalogue failed to load', () => {
  render(<RedactionView documents={{ status: 'error' }} document={null} onSelect={vi.fn()} onResolved={vi.fn()} />)
  expect(screen.getByText(fr.redaction.error)).toBeInTheDocument()
})

it('lists the documents in the sidebar and shows the open one', () => {
  render(
    <RedactionView
      documents={summaries}
      document={{ status: 'ready', document: doc }}
      onSelect={vi.fn()}
      onResolved={vi.fn()}
    />,
  )

  expect(screen.getByRole('button', { pressed: true, name: /Compte-rendu/ })).toBeInTheDocument()
  expect(screen.getByText('Compte-rendu', { selector: 'h2' })).toBeInTheDocument()
  expect(screen.getByText(fr.redaction.wordCount(6), { exact: false })).toBeInTheDocument()
})

it('calls onSelect when a sidebar entry is picked', async () => {
  const onSelect = vi.fn()
  render(<RedactionView documents={summaries} document={null} onSelect={onSelect} onResolved={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: /Compte-rendu/ }))
  expect(onSelect).toHaveBeenCalledWith('doc1')
})

it('highlights the pending suggestion anchor in the body', () => {
  render(
    <RedactionView
      documents={summaries}
      document={{ status: 'ready', document: doc }}
      onSelect={vi.fn()}
      onResolved={vi.fn()}
    />,
  )

  const matches = screen.getAllByText(/reciser la transition/)
  expect(matches.length).toBeGreaterThan(0)
})

it('accepts a suggestion and reports back so the caller can refetch', async () => {
  vi.stubGlobal('fetch', answer(200))
  const onResolved = vi.fn()

  render(
    <RedactionView
      documents={summaries}
      document={{ status: 'ready', document: doc }}
      onSelect={vi.fn()}
      onResolved={onResolved}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: fr.redaction.accept }))

  await waitFor(() => expect(onResolved).toHaveBeenCalled())
  const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
  expect(url).toBe('/api/v1/documents/doc1/suggestions/s1/accept')
})

it('shows a failure when resolving does not go through', async () => {
  vi.stubGlobal('fetch', answer(502))

  render(
    <RedactionView
      documents={summaries}
      document={{ status: 'ready', document: doc }}
      onSelect={vi.fn()}
      onResolved={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: fr.redaction.ignore }))

  await waitFor(() => expect(screen.getByText(fr.redaction.resolveFailed)).toBeInTheDocument())
})
