import { renderHook, waitFor } from '@testing-library/react'
import { useRegistry } from './useRegistry'

const catalogue = {
  source: 'kern-orch',
  at: '2026-07-27T12:00:00Z',
  skills: [{ name: 'Analyse', kind: 'tool' }],
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

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  expect(result.current.status).toBe('loading')
})

it('holds the catalogue once it arrives', async () => {
  vi.stubGlobal('fetch', answer(200, catalogue))

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current).toEqual({ status: 'ready', catalogue })
})

// The distinction the view is built on: 404 means kern-orch never spoke, and the Grimoire
// must say so rather than claim an empty catalogue it has no evidence for.
it('reports an unpublished registry apart from a failure', async () => {
  vi.stubGlobal('fetch', answer(404))

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  await waitFor(() => expect(result.current.status).toBe('unpublished'))
})

it('reports a server error as an error', async () => {
  vi.stubGlobal('fetch', answer(500))

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

it('survives an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

it('survives a malformed body without taking the view down', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response),
  )

  const { result } = renderHook(() => useRegistry('/api/v1/registry'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})
