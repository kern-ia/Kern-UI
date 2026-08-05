import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useDecisions } from './useDecisions'
import type { Decision } from './types'

/** Same fake as runs/useRunStream.test.ts — jsdom ships no EventSource. */
class FakeEventSource {
  static instances: FakeEventSource[] = []

  url: string
  closed = false
  private listeners = new Map<string, Set<(e: MessageEvent) => void>>()
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(fn)
  }

  close() {
    this.closed = true
  }

  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) })
    for (const fn of this.listeners.get(type) ?? []) fn(event)
  }

  fail() {
    this.onerror?.()
  }
}

function decision(rule: string, overrides: Partial<Decision> = {}): Decision {
  return {
    at: '2026-08-05T12:00:00Z',
    layer: 'behaviour',
    decision: 'warn',
    rule,
    run_id: 'r1',
    ...overrides,
  }
}

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function latest() {
  const source = FakeEventSource.instances.at(-1)
  if (!source) throw new Error('no EventSource was opened')
  return source
}

it('opens a stream and starts out connecting, with no decisions yet', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))

  expect(latest().url).toBe('/api/v1/vigie/decisions')
  expect(result.current.connection).toBe('connecting')
  expect(result.current.decisions).toEqual([])
})

// Unlike the run stream, there is no snapshot event — a decision has no "current state"
// to open with, only a moment it either was or wasn't seen.
it('opens the connection without waiting for a snapshot event', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))

  act(() => latest().emit('decision', decision('too-many')))

  expect(result.current.decisions.map((d) => d.rule)).toEqual(['too-many'])
  expect(result.current.connection).toBe('open')
})

it('keeps the newest decision first', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))

  act(() => latest().emit('decision', decision('first')))
  act(() => latest().emit('decision', decision('second')))

  expect(result.current.decisions.map((d) => d.rule)).toEqual(['second', 'first'])
})

// A best-effort feed, not an event log (see stream.Hub's own doc comment) — the browser
// must bound what it holds rather than grow forever over a long session.
it('caps the list rather than growing forever', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))

  act(() => {
    for (let i = 0; i < 150; i++) {
      latest().emit('decision', decision(`rule-${i}`))
    }
  })

  expect(result.current.decisions.length).toBeLessThanOrEqual(100)
  expect(result.current.decisions[0].rule).toBe('rule-149')
})

it('ignores a malformed frame rather than crashing', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))
  act(() => latest().emit('decision', decision('r1')))

  act(() => {
    const event = new MessageEvent('decision', { data: '{not json' })
    // @ts-expect-error reaching into the fake to deliver a broken payload
    for (const fn of latest().listeners.get('decision') ?? []) fn(event)
  })

  expect(result.current.decisions.map((d) => d.rule)).toEqual(['r1'])
})

it('reports a lost connection', () => {
  const { result } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))

  act(() => latest().fail())

  expect(result.current.connection).toBe('error')
})

it('closes the stream when the component unmounts', () => {
  const { unmount } = renderHook(() => useDecisions('/api/v1/vigie/decisions'))
  const source = latest()

  unmount()

  expect(source.closed).toBe(true)
})
