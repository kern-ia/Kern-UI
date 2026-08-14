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

// C11: creating or deleting a sub-agent changes the registry outside of kern-orch's own
// next publication. Bumping refreshKey is the escape hatch — it must trigger a real
// second fetch, not just a state update.
it('refetches when refreshKey changes', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => catalogue } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...catalogue, skills: [{ name: 'accueil', kind: 'agent' }] }),
    } as Response)
  vi.stubGlobal('fetch', fetchMock)

  const { result, rerender } = renderHook(({ key }) => useRegistry('/api/v1/registry', key), {
    initialProps: { key: 0 },
  })

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(fetchMock).toHaveBeenCalledTimes(1)

  rerender({ key: 1 })

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
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
