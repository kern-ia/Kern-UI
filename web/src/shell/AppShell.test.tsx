import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { AppShell } from './AppShell'
import { fr } from '../i18n/fr'
import { VIEWS, mobileViews } from './views'

type Listener = (e: MessageEvent) => void

class FakeEventSource {
  static last: FakeEventSource | null = null
  private listeners = new Map<string, Set<Listener>>()
  onerror: (() => void) | null = null
  url: string

  constructor(url: string) {
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

const liveRun = {
  id: 'r1',
  graph: 'review',
  status: 'running',
  step: 2,
  frontier: ['analyse'],
  started_at: '2026-07-26T12:00:00Z',
  updated_at: '2026-07-26T12:00:02Z',
}

beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource))
afterEach(() => vi.unstubAllGlobals())

function nav() {
  return screen.getByRole('navigation', { name: fr.nav.primary })
}

function compactNav() {
  return screen.getByRole('navigation', { name: fr.nav.compact })
}

it('offers every view of the mockup', () => {
  render(<AppShell />)

  for (const view of VIEWS) {
    expect(within(nav()).getByRole('tab', { name: fr.views[view.id] })).toBeInTheDocument()
  }
})

it('keeps a reduced navigation for phones', () => {
  // The mockup drops Navigateur and Rédaction on mobile; the shell must not silently
  // grow that list back.
  expect(mobileViews().map((v) => v.id)).toEqual(['cerveau', 'agents', 'espace', 'grimoire'])

  render(<AppShell />)
  const compact = within(compactNav()).getAllByRole('tab')

  expect(compact).toHaveLength(4)
  expect(compact.map((t) => t.textContent)).not.toContain(
    expect.stringContaining(fr.views.navigateur),
  )
})

it('gives its two navigations distinct names', () => {
  render(<AppShell />)

  expect(nav()).toBeInTheDocument()
  expect(compactNav()).toBeInTheDocument()
})

it('opens on the only view a brick can feed', () => {
  render(<AppShell />)

  expect(within(nav()).getByRole('tab', { name: fr.views.agents })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

it('switches view on click', () => {
  render(<AppShell />)

  fireEvent.click(within(nav()).getByRole('tab', { name: fr.views.cerveau }))

  expect(within(nav()).getByRole('tab', { name: fr.views.cerveau })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByText(fr.missing.awaiting.memoire)).toBeInTheDocument()
})

it('draws the catalogue kern-orch published in the Grimoire', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'kern-orch',
        at: '2026-07-27T12:00:00Z',
        skills: [{ name: 'Analyse', kind: 'tool' }],
      }),
    } as Response),
  )

  render(<AppShell />)
  fireEvent.click(within(nav()).getByRole('tab', { name: fr.views.grimoire }))

  expect(await screen.findByRole('heading', { name: fr.grimoire.competences })).toBeInTheDocument()
  expect(screen.getByText('Analyse')).toBeInTheDocument()
})

// The Espace has the catalogue; what it lacks is the reading behind a widget. It says so in
// the reader's terms, and says nothing about which module owes it.
it('tells the Espace apart: it waits for the readings, not for the catalogue', () => {
  render(<AppShell />)

  fireEvent.click(within(nav()).getByRole('tab', { name: fr.views.espace }))

  expect(screen.getByText(fr.missing.awaiting.outils)).toBeInTheDocument()
})

// A demo audience must never read our module layout off a screen.
it('names no brick anywhere in the shell', () => {
  const { container } = render(<AppShell />)

  for (const view of VIEWS) {
    fireEvent.click(within(nav()).getByRole('tab', { name: fr.views[view.id] }))
    expect(container.textContent).not.toMatch(/kern-(orch|pilot|memory|exec|obs)/i)
  }
})

it('shows live runs in the Agents view', () => {
  render(<AppShell />)

  act(() => FakeEventSource.last!.emit('snapshot', [liveRun]))

  expect(screen.getByText('review')).toBeInTheDocument()
})

it('moves the beacon from rest to action when a run is live', () => {
  render(<AppShell />)
  expect(screen.getByTestId('system-state')).toHaveTextContent(fr.systemState.repos)

  act(() => FakeEventSource.last!.emit('snapshot', [liveRun]))

  expect(screen.getByTestId('system-state')).toHaveTextContent(fr.systemState.action)
})

it('keeps the conversation bar on every view, disabled and saying why', () => {
  render(<AppShell />)

  for (const view of VIEWS) {
    fireEvent.click(within(nav()).getByRole('tab', { name: fr.views[view.id] }))

    const input = screen.getByPlaceholderText(fr.chat.placeholder)
    expect(input).toBeDisabled()
    expect(screen.getByText(fr.chat.unavailable)).toBeInTheDocument()
  }
})
