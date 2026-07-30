import { resolveSuggestion } from './api'

function answer(status: number) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('posts to the accept endpoint', async () => {
  const fetchMock = answer(200)
  vi.stubGlobal('fetch', fetchMock)

  await resolveSuggestion('doc1', 's1', true)

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/documents/doc1/suggestions/s1/accept')
  expect(init.method).toBe('POST')
})

it('posts to the ignore endpoint', async () => {
  const fetchMock = answer(200)
  vi.stubGlobal('fetch', fetchMock)

  await resolveSuggestion('doc1', 's1', false)

  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/documents/doc1/suggestions/s1/ignore')
})

it('throws when kern-ui refuses', async () => {
  vi.stubGlobal('fetch', answer(404))

  await expect(resolveSuggestion('doc1', 'nope', true)).rejects.toThrow()
})
