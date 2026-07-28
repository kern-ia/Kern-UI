import { act, renderHook, waitFor } from '@testing-library/react'
import { useSession } from './useSession'

function respond(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

it('starts out not knowing', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  const { result } = renderHook(() => useSession())

  expect(result.current.state.status).toBe('loading')
})

it('reports who is signed in', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { name: 'yoann' })))

  const { result } = renderHook(() => useSession())

  await waitFor(() => expect(result.current.state).toEqual({ status: 'signed-in', name: 'yoann' }))
})

// A server with no accounts answers 200 with an empty name. That is not "logged out" — it
// is a server nobody has to log into, and asking for a password would invent a wall.
it('treats a server with no accounts as open', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { name: '' })))

  const { result } = renderHook(() => useSession())

  await waitFor(() => expect(result.current.state).toEqual({ status: 'signed-in', name: '' }))
})

it('asks for a login when the server refuses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)))

  const { result } = renderHook(() => useSession())

  await waitFor(() => expect(result.current.state.status).toBe('anonymous'))
})

// An unreachable server is not a locked one: showing a login form would invite someone to
// type a password into a page that cannot check it.
it('tells an unreachable server apart from a locked one', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  const { result } = renderHook(() => useSession())

  await waitFor(() => expect(result.current.state.status).toBe('error'))
})

it('signs in and remembers who', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(respond(401))
    .mockResolvedValueOnce(respond(200, { name: 'yoann' }))
  vi.stubGlobal('fetch', fetchMock)

  const { result } = renderHook(() => useSession())
  await waitFor(() => expect(result.current.state.status).toBe('anonymous'))

  let ok: boolean | undefined
  await act(async () => {
    ok = await result.current.signIn({ name: 'yoann', password: 'x' })
  })

  expect(ok).toBe(true)
  expect(result.current.state).toEqual({ status: 'signed-in', name: 'yoann' })
})

it('stays anonymous when the credentials are refused', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(respond(401))
    .mockResolvedValueOnce(respond(401))
  vi.stubGlobal('fetch', fetchMock)

  const { result } = renderHook(() => useSession())
  await waitFor(() => expect(result.current.state.status).toBe('anonymous'))

  let ok: boolean | undefined
  await act(async () => {
    ok = await result.current.signIn({ name: 'yoann', password: 'faux' })
  })

  expect(ok).toBe(false)
  expect(result.current.state.status).toBe('anonymous')
})

it('signs out', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(respond(200, { name: 'yoann' }))
    .mockResolvedValueOnce(respond(204))
  vi.stubGlobal('fetch', fetchMock)

  const { result } = renderHook(() => useSession())
  await waitFor(() => expect(result.current.state.status).toBe('signed-in'))

  await act(async () => {
    await result.current.signOut()
  })

  expect(result.current.state.status).toBe('anonymous')
})
