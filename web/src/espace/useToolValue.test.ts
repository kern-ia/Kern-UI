import { renderHook, waitFor } from '@testing-library/react'
import { useToolValue } from './useToolValue'

const result = { label: 'Battement', value: '17:09:11', as_of: '2026-07-29T17:09:11+02:00' }

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

  const { result: hook } = renderHook(() => useToolValue('/api/v1/tools', 'heartbeat'))

  expect(hook.current.status).toBe('loading')
})

it('holds the value once invoked', async () => {
  const fetchMock = answer(200, result)
  vi.stubGlobal('fetch', fetchMock)

  const { result: hook } = renderHook(() => useToolValue('/api/v1/tools', 'heartbeat'))

  await waitFor(() => expect(hook.current.status).toBe('ready'))
  expect(hook.current).toEqual({ status: 'ready', result })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/tools/heartbeat/invoke')
  expect(init.method).toBe('POST')
})

it('reports a failed invocation as an error', async () => {
  vi.stubGlobal('fetch', answer(502))

  const { result: hook } = renderHook(() => useToolValue('/api/v1/tools', 'heartbeat'))

  await waitFor(() => expect(hook.current.status).toBe('error'))
})

it('survives an unreachable server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result: hook } = renderHook(() => useToolValue('/api/v1/tools', 'heartbeat'))

  await waitFor(() => expect(hook.current.status).toBe('error'))
})
