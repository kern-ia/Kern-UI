import { renderHook, waitFor } from '@testing-library/react'
import { useDocuments } from './useDocuments'

const summaries = [{ id: 'doc1', title: 'Compte-rendu', word_count: 3, updated_at: '2026-07-30T10:00:00Z' }]

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

  const { result } = renderHook(() => useDocuments('/api/v1/documents'))

  expect(result.current.status).toBe('loading')
})

it('holds the catalogue once it arrives', async () => {
  vi.stubGlobal('fetch', answer(200, summaries))

  const { result } = renderHook(() => useDocuments('/api/v1/documents'))

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current).toEqual({ status: 'ready', documents: summaries })
})

it('reports an unconfigured source apart from a failure', async () => {
  vi.stubGlobal('fetch', answer(404))

  const { result } = renderHook(() => useDocuments('/api/v1/documents'))

  await waitFor(() => expect(result.current.status).toBe('unconfigured'))
})

it('reports a server error as an error', async () => {
  vi.stubGlobal('fetch', answer(502))

  const { result } = renderHook(() => useDocuments('/api/v1/documents'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

it('survives an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result } = renderHook(() => useDocuments('/api/v1/documents'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})
