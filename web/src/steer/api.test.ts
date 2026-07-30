import { decide, dispatch, nudge, stopRun } from './api'

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'error',
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('stopRun posts to the run-scoped endpoint', async () => {
  const fetchMock = answer(202, { status: 'stopping' })
  vi.stubGlobal('fetch', fetchMock)

  await stopRun('r1')

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/stop')
  expect(init.method).toBe('POST')
})

it('decide posts the decision to the node-scoped endpoint', async () => {
  const fetchMock = answer(200, { status: 'decided' })
  vi.stubGlobal('fetch', fetchMock)

  await decide('r1', 'confirm', 'approve')

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/nodes/confirm/decide')
  expect(JSON.parse(init.body as string)).toEqual({ decision: 'approve' })
})

it('nudge posts the key and value', async () => {
  const fetchMock = answer(202, { status: 'queued' })
  vi.stubGlobal('fetch', fetchMock)

  await nudge('r1', 'message', 'bonjour')

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/nudge')
  expect(JSON.parse(init.body as string)).toEqual({ key: 'message', value: 'bonjour' })
})

it('dispatch posts the skill and text and returns the decoded result', async () => {
  vi.stubGlobal('fetch', answer(200, { kind: 'tool', result: { label: 'Battement', value: '17:09', as_of: '' } }))

  const result = await dispatch('heartbeat', '')

  expect(result).toEqual({ kind: 'tool', result: { label: 'Battement', value: '17:09', as_of: '' } })
})

it('throws a SteerError carrying the status and message on failure', async () => {
  vi.stubGlobal('fetch', answer(403, { error: "not this run's requester" }))

  await expect(stopRun('r1')).rejects.toMatchObject({
    status: 403,
    message: "not this run's requester",
  })
})

it('carries the known skill names on an unknown-skill dispatch failure', async () => {
  vi.stubGlobal('fetch', answer(404, { error: 'unknown skill', known: ['heartbeat', 'planner'] }))

  await expect(dispatch('jamais', '')).rejects.toMatchObject({
    known: ['heartbeat', 'planner'],
  })
})
