import { renderHook, waitFor } from '@testing-library/react'
import { useTools } from './useTools'

const specs = [{ name: 'heartbeat', description: 'reports the time' }]

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

  const { result } = renderHook(() => useTools('/api/v1/tools'))

  expect(result.current.status).toBe('loading')
})

it('holds the catalogue once it arrives', async () => {
  vi.stubGlobal('fetch', answer(200, specs))

  const { result } = renderHook(() => useTools('/api/v1/tools'))

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current).toEqual({ status: 'ready', specs })
})

// The distinction the view is built on: 404 means no tool source is configured, which the
// Espace must say apart from a genuine failure.
it('reports an unconfigured source apart from a failure', async () => {
  vi.stubGlobal('fetch', answer(404))

  const { result } = renderHook(() => useTools('/api/v1/tools'))

  await waitFor(() => expect(result.current.status).toBe('unconfigured'))
})

it('reports a server error as an error', async () => {
  vi.stubGlobal('fetch', answer(502))

  const { result } = renderHook(() => useTools('/api/v1/tools'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

it('survives an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result } = renderHook(() => useTools('/api/v1/tools'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})
