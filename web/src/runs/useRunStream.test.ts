import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useRunStream } from './useRunStream'
import type { Run } from './types'

/** Minimal EventSource stand-in: jsdom ships none. */
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

  /** Test helper: deliver a server-sent event. */
  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) })
    for (const fn of this.listeners.get(type) ?? []) fn(event)
  }

  fail() {
    this.onerror?.()
  }
}

function run(id: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    graph: 'review',
    status: 'running',
    step: 1,
    frontier: ['analyse'],
    started_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:00Z',
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

it('opens a stream and starts out connecting', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  expect(latest().url).toBe('/api/v1/stream')
  expect(result.current.connection).toBe('connecting')
  expect(result.current.runs).toEqual([])
})

it('adopts the snapshot as the initial list', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  act(() => latest().emit('snapshot', [run('r1'), run('r2')]))

  expect(result.current.runs.map((r) => r.id)).toEqual(['r1', 'r2'])
  expect(result.current.connection).toBe('open')
})

it('treats a null snapshot as an empty list', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  act(() => latest().emit('snapshot', null))

  expect(result.current.runs).toEqual([])
  expect(result.current.connection).toBe('open')
})

it('merges live updates into the list', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  act(() => latest().emit('snapshot', [run('r1')]))
  act(() => latest().emit('run', run('r1', { step: 4, status: 'finished', frontier: [] })))

  expect(result.current.runs).toHaveLength(1)
  expect(result.current.runs[0].step).toBe(4)
  expect(result.current.runs[0].status).toBe('finished')
})

it('adds a run first seen on the live channel', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  act(() => latest().emit('snapshot', []))
  act(() => latest().emit('run', run('fresh')))

  expect(result.current.runs.map((r) => r.id)).toEqual(['fresh'])
})

it('ignores a malformed frame rather than crashing', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))
  act(() => latest().emit('snapshot', [run('r1')]))

  act(() => {
    const event = new MessageEvent('run', { data: '{not json' })
    // @ts-expect-error reaching into the fake to deliver a broken payload
    for (const fn of latest().listeners.get('run') ?? []) fn(event)
  })

  expect(result.current.runs.map((r) => r.id)).toEqual(['r1'])
})

it('reports a lost connection', () => {
  const { result } = renderHook(() => useRunStream('/api/v1/stream'))

  act(() => latest().fail())

  expect(result.current.connection).toBe('error')
})

it('closes the stream when the component unmounts', () => {
  const { unmount } = renderHook(() => useRunStream('/api/v1/stream'))
  const source = latest()

  unmount()

  expect(source.closed).toBe(true)
})
