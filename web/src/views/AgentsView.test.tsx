import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentsView } from './AgentsView'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'

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

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    graph: 'hello',
    status: 'running',
    step: 1,
    frontier: ['finish'],
    started_at: '2026-07-27T12:00:00Z',
    updated_at: '2026-07-27T12:00:01Z',
    ...over,
  }
}

// A run now becomes visible the moment an agent starts working, which is before its first
// level completes and so before its shape has been sent. "Never declared" would be a
// statement about the producer; at step 0 the truth is only that it has not arrived yet.
it('says the topology is still on its way before the first level', () => {
  render(<AgentsView runs={[run({ step: 0, frontier: [], generating: ['greet'] })]} />)

  expect(screen.getByText(fr.hive.topologyPending)).toBeInTheDocument()
  expect(screen.queryByText(fr.hive.noTopology)).not.toBeInTheDocument()
})

// Past the first level, a missing topology really is something the producer never sent.
it('says the topology was never declared once a level has completed', () => {
  render(<AgentsView runs={[run({ step: 2 })]} />)

  expect(screen.getByText(fr.hive.noTopology)).toBeInTheDocument()
  expect(screen.queryByText(fr.hive.topologyPending)).not.toBeInTheDocument()
})

it('draws the hive as soon as a topology is known', () => {
  const withShape = run({
    topology: { entry: 'greet', nodes: [{ id: 'greet', kind: 'agent' }] },
  })

  render(<AgentsView runs={[withShape]} />)

  expect(screen.queryByText(fr.hive.noTopology)).not.toBeInTheDocument()
  expect(screen.queryByText(fr.hive.topologyPending)).not.toBeInTheDocument()
})

it('offers to stop a live run with no requester', async () => {
  const fetchMock = answer(202, { status: 'stopping' })
  vi.stubGlobal('fetch', fetchMock)

  render(<AgentsView runs={[run()]} />)
  const button = screen.getByRole('button', { name: fr.runs.stop })
  expect(button).not.toBeDisabled()

  fireEvent.click(button)

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/stop')
})

it('disables stopping someone else\'s mission, and says why', () => {
  render(<AgentsView runs={[run({ requester: 'yoann' })]} user="pas-yoann" />)

  const button = screen.getByRole('button', { name: fr.runs.stop })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', fr.runs.stopUnavailable)
})

it('lets the requester stop their own mission', () => {
  render(<AgentsView runs={[run({ requester: 'yoann' })]} user="yoann" />)

  expect(screen.getByRole('button', { name: fr.runs.stop })).not.toBeDisabled()
})

it('shows no stop control for a finished run', () => {
  render(<AgentsView runs={[run({ status: 'finished', frontier: [] })]} />)

  expect(screen.queryByRole('button', { name: fr.runs.stop })).not.toBeInTheDocument()
})

it('shows the approval panel for a run parked on an approval node', async () => {
  const fetchMock = answer(200, { status: 'decided' })
  vi.stubGlobal('fetch', fetchMock)

  const parked = run({
    frontier: ['confirm'],
    topology: {
      entry: 'confirm',
      nodes: [{ id: 'confirm', kind: 'approval' }],
    },
  })
  render(<AgentsView runs={[parked]} />)

  expect(screen.getByText(fr.runs.awaitingDecision('confirm'))).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: fr.runs.approve }))

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/nodes/confirm/decide')
  expect(JSON.parse(init.body as string)).toEqual({ decision: 'approve' })
})

it('shows no approval panel once the node is no longer active', () => {
  const done = run({
    status: 'finished',
    frontier: [],
    visited: ['confirm'],
    topology: {
      entry: 'confirm',
      nodes: [{ id: 'confirm', kind: 'approval' }],
    },
  })
  render(<AgentsView runs={[done]} />)

  expect(screen.queryByText(fr.runs.awaitingDecision('confirm'))).not.toBeInTheDocument()
})
