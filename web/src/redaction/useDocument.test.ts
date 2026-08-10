import { act } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { useDocument } from './useDocument'

const doc = {
  id: 'doc1',
  title: 'Compte-rendu',
  body: 'un deux trois',
  word_count: 3,
  updated_at: '2026-07-30T10:00:00Z',
  suggestions: [{ id: 's1', anchor_start: 0, anchor_end: 2, text: 'x', status: 'pending' as const }],
}

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('starts out loading', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  const { result } = renderHook(() => useDocument('/api/v1/documents', 'doc1'))

  expect(result.current[0].status).toBe('loading')
})

it('holds the document once it arrives', async () => {
  const fetchMock = answer(200, doc)
  vi.stubGlobal('fetch', fetchMock)

  const { result } = renderHook(() => useDocument('/api/v1/documents', 'doc1'))

  await waitFor(() => expect(result.current[0].status).toBe('ready'))
  expect(result.current[0]).toEqual({ status: 'ready', document: doc })
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/documents/doc1')
})

it('reports a server error as an error', async () => {
  vi.stubGlobal('fetch', answer(502))

  const { result } = renderHook(() => useDocument('/api/v1/documents', 'doc1'))

  await waitFor(() => expect(result.current[0].status).toBe('error'))
})

it('refetches when asked, picking up a changed suggestion status', async () => {
  const accepted = { ...doc, suggestions: [{ ...doc.suggestions[0], status: 'accepted' as const }] }
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => doc } as Response)
  vi.stubGlobal('fetch', fetchMock)

  const { result } = renderHook(() => useDocument('/api/v1/documents', 'doc1'))
  await waitFor(() => expect(result.current[0].status).toBe('ready'))

  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => accepted } as Response)
  act(() => result.current[1]())

  await waitFor(() =>
    expect(result.current[0]).toEqual({ status: 'ready', document: accepted }),
  )
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('makes no request while no document is selected', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  renderHook(() => useDocument('/api/v1/documents', null))

  expect(fetchMock).not.toHaveBeenCalled()
})
