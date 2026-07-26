import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import App from './App'
import { fr } from './i18n/fr'

type Listener = (e: MessageEvent) => void

/** jsdom has no EventSource; this stand-in lets the app mount and receive frames. */
class FakeEventSource {
  static last: FakeEventSource | null = null

  private listeners = new Map<string, Set<Listener>>()
  onerror: (() => void) | null = null
  url: string

  constructor(url: string) {
    // A constructor parameter property would trip `erasableSyntaxOnly`.
    this.url = url
    FakeEventSource.last = this
  }

  addEventListener(type: string, fn: Listener) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn)
  }

  close() {}

  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) })
    for (const fn of this.listeners.get(type) ?? []) fn(event)
  }
}

beforeEach(() => {
  FakeEventSource.last = null
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the product name and the connection state', () => {
  render(<App />)

  expect(screen.getByText(fr.appName)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(fr.connection.connecting)
})

it('starts on the empty state and fills in from the snapshot', () => {
  render(<App />)
  expect(screen.getByText(fr.runs.empty)).toBeInTheDocument()

  act(() =>
    FakeEventSource.last!.emit('snapshot', [
      {
        id: 'r1',
        graph: 'review',
        status: 'running',
        step: 2,
        frontier: ['analyse'],
        started_at: '2026-07-26T12:00:00Z',
        updated_at: '2026-07-26T12:00:02Z',
      },
    ]),
  )

  expect(screen.getByText('review')).toBeInTheDocument()
  expect(screen.getByText(fr.runs.count(1))).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(fr.connection.open)
})

it('reports the outage when the stream drops', () => {
  render(<App />)

  act(() => FakeEventSource.last!.onerror?.())

  expect(screen.getByRole('status')).toHaveTextContent(fr.connection.error)
})
