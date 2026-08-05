import { renderHook, waitFor } from '@testing-library/react'
import { useBudget } from './useBudget'

const budget = {
  spent_micros: 18000,
  limit_micros: 1_000_000,
  unpriced_calls: 1,
  unaccounted_calls: 0,
  window_resets_at: '2026-08-05T00:00:00Z',
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
  vi.useRealTimers()
})

it('starts out loading', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  const { result } = renderHook(() => useBudget('/api/v1/vigie/budget'))

  expect(result.current.status).toBe('loading')
})

it('holds the snapshot once it arrives', async () => {
  vi.stubGlobal('fetch', answer(200, budget))

  const { result } = renderHook(() => useBudget('/api/v1/vigie/budget'))

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current).toEqual({ status: 'ready', budget })
})

// Same distinction as the Espace's tool source: 404 means nothing is configured, which
// must read apart from a genuine failure.
it('reports an unconfigured source apart from a failure', async () => {
  vi.stubGlobal('fetch', answer(404))

  const { result } = renderHook(() => useBudget('/api/v1/vigie/budget'))

  await waitFor(() => expect(result.current.status).toBe('unconfigured'))
})

it('reports a server error as an error', async () => {
  vi.stubGlobal('fetch', answer(502))

  const { result } = renderHook(() => useBudget('/api/v1/vigie/budget'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

it('survives an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result } = renderHook(() => useBudget('/api/v1/vigie/budget'))

  await waitFor(() => expect(result.current.status).toBe('error'))
})

// The gauge is a snapshot, not a subscription: it has to refresh on its own schedule
// rather than sit stale until the browser tab is reopened.
it('refetches on an interval', async () => {
  vi.useFakeTimers()
  const fetchMock = answer(200, budget)
  vi.stubGlobal('fetch', fetchMock)

  renderHook(() => useBudget('/api/v1/vigie/budget'))
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

  await vi.advanceTimersByTimeAsync(15_000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
