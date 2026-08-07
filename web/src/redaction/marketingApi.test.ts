import { fetchMarketingItems, upsertMarketingItem } from './marketingApi'
import type { ContentItem } from './marketing'

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    runId: 'a', graph: 'community-management-agency', title: 't', platform: 'p',
    date: null, status: 'brouillon', text: 'x', ...over,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('posts the item to the marketing items endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  vi.stubGlobal('fetch', fetchMock)

  await upsertMarketingItem(item({ runId: 'a', title: 'Post LinkedIn', date: new Date(2026, 7, 10) }))

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/marketing/items')
  expect(init.method).toBe('POST')
  const body = JSON.parse(init.body)
  expect(body).toMatchObject({ run_id: 'a', title: 'Post LinkedIn', date: '2026-08-10' })
})

it('sends an empty date string for a dateless item', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  vi.stubGlobal('fetch', fetchMock)

  await upsertMarketingItem(item({ date: null }))

  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.date).toBe('')
})

it('throws when kern-ui refuses the write', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 } as Response))

  await expect(upsertMarketingItem(item())).rejects.toThrow()
})

it('fetches and decodes persisted items', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [
      { run_id: 'b', title: 'Persisté', platform: 'LinkedIn', status: 'publie', date: '2026-08-10', text: 'contenu' },
    ],
  } as Response)
  vi.stubGlobal('fetch', fetchMock)

  const items = await fetchMarketingItems()

  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/marketing/items')
  expect(items).toHaveLength(1)
  expect(items[0].runId).toBe('b')
  expect(items[0].date).toEqual(new Date('2026-08-10'))
})

it('throws when kern-ui refuses the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 } as Response))

  await expect(fetchMarketingItems()).rejects.toThrow()
})
