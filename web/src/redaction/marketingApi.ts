import type { ContentItem } from './marketing'

interface MarketingItemDTO {
  run_id: string
  title: string
  platform: string
  status: string
  date: string
  text: string
}

// Formats from local date components, not toISOString() — that converts to UTC first,
// which shifts the calendar day near midnight in any timezone ahead of or behind UTC
// (found writing this test: 2026-08-10 local became "2026-08-09" in the request body).
function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDTO(item: ContentItem): MarketingItemDTO {
  return {
    run_id: item.runId,
    title: item.title,
    platform: item.platform,
    status: item.status,
    date: item.date ? isoDate(item.date) : '',
    text: item.text,
  }
}

function fromDTO(dto: MarketingItemDTO): ContentItem {
  return {
    runId: dto.run_id,
    graph: '', // not persisted — unused past contentItemOf, harmless once reconstructed
    title: dto.title,
    platform: dto.platform,
    date: dto.date ? new Date(dto.date) : null,
    status: dto.status as ContentItem['status'],
    text: dto.text,
  }
}

/** Persists one item so it survives a kern-ui restart (see marketing.ts, mergeItems).
 * Best-effort by design: a failure here must never break the calendar the user is looking
 * at, only the (silent) background sync. */
export async function upsertMarketingItem(item: ContentItem): Promise<void> {
  const response = await fetch('/api/v1/marketing/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toDTO(item)),
  })
  if (!response.ok) {
    throw new Error(`upsertMarketingItem: kern-ui answered ${response.status}`)
  }
}

/** Fetches every persisted item. Throws on failure — the caller decides whether that's
 * fatal (it isn't: an empty persisted set just means "nothing to merge in yet"). */
export async function fetchMarketingItems(): Promise<ContentItem[]> {
  const response = await fetch('/api/v1/marketing/items')
  if (!response.ok) {
    throw new Error(`fetchMarketingItems: kern-ui answered ${response.status}`)
  }
  const dtos = (await response.json()) as MarketingItemDTO[]
  return dtos.map(fromDTO)
}
