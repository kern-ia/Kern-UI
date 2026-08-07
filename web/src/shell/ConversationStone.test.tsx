import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { ConversationStone } from './ConversationStone'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'

// jsdom reports a zero-sized layout, so pointer dragging cannot be exercised meaningfully
// here — the arithmetic it relies on is covered in stone.test.ts. What matters at this
// level is what the user can see and reach: the bubble, and the keyboard path.

beforeEach(() => localStorage.clear())

function stone() {
  return screen.getByRole('button', { name: new RegExp(`${fr.chat.stoneHide}|${fr.chat.stoneShow}`) })
}

it('shows the conversation beside the stone by default', () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)

  expect(screen.getByPlaceholderText(fr.chat.placeholder)).toBeInTheDocument()
  expect(stone()).toHaveAttribute('aria-pressed', 'false')
})

it('tidies the bubble away when docked, keeping the stone reachable', () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)

  fireEvent.keyDown(stone(), { key: 'Enter' })

  expect(screen.queryByPlaceholderText(fr.chat.placeholder)).not.toBeInTheDocument()
  expect(stone()).toBeInTheDocument()
  expect(stone()).toHaveAttribute('aria-pressed', 'true')
})

it('cycles right, left, then back to free from the keyboard', () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)
  const group = stone().parentElement!

  fireEvent.keyDown(stone(), { key: 'Enter' })
  expect(group).toHaveAttribute('data-docked', 'right')

  fireEvent.keyDown(stone(), { key: ' ' })
  expect(group).toHaveAttribute('data-docked', 'left')

  fireEvent.keyDown(stone(), { key: 'Enter' })
  expect(group).toHaveAttribute('data-docked', 'none')
  expect(screen.getByPlaceholderText(fr.chat.placeholder)).toBeInTheDocument()
})

it('names the action for whoever cannot see the stone', () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)
  expect(screen.getByRole('button', { name: fr.chat.stoneHide })).toBeInTheDocument()

  fireEvent.keyDown(stone(), { key: 'Enter' })
  expect(screen.getByRole('button', { name: fr.chat.stoneShow })).toBeInTheDocument()
})

// Regression: the drag handlers used to read `dragging` from state, so every move that
// arrived before React re-rendered was silently dropped. A burst in one tick moved nothing.
it('follows a burst of moves that lands before a re-render', () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)
  const handle = stone()
  const group = handle.parentElement!
  // jsdom reports a zero-sized parent, so give the arithmetic a container to work with.
  vi.spyOn(handle.parentElement!.parentElement!, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect)

  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 300 })
  for (const clientX of [200, 400, 600, 800]) {
    fireEvent.pointerMove(handle, { pointerId: 1, clientX, clientY: 300 })
  }

  expect(group.style.left).not.toBe('')
  expect(parseFloat(group.style.left)).toBeGreaterThan(400)

  vi.restoreAllMocks()
})

it('remembers where it was left', () => {
  const { unmount } = render(<ConversationStone stateColour="var(--state-idle)" />)
  fireEvent.keyDown(stone(), { key: 'Enter' })
  unmount()

  render(<ConversationStone stateColour="var(--state-idle)" />)

  expect(stone()).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByPlaceholderText(fr.chat.placeholder)).not.toBeInTheDocument()
})

it('survives a storage that refuses to answer', () => {
  const boom = () => {
    throw new Error('quota')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)

  expect(() => render(<ConversationStone stateColour="var(--state-idle)" />)).not.toThrow()
  expect(screen.getByPlaceholderText(fr.chat.placeholder)).toBeInTheDocument()

  vi.restoreAllMocks()
})

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'error',
    json: async () => body,
  } as Response)
}

const sampleRun: Run = {
  id: 'r1',
  graph: 'review',
  status: 'running',
  step: 1,
  frontier: ['a'],
  started_at: '2026-07-30T12:00:00Z',
  updated_at: '2026-07-30T12:00:00Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('dispatches a /skill-name command and shows the tool value', async () => {
  vi.stubGlobal(
    'fetch',
    answer(200, { kind: 'tool', result: { label: 'Battement', value: '17:09', as_of: '' } }),
  )

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/heartbeat' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => expect(screen.getByText('Battement : 17:09')).toBeInTheDocument())
  expect(input).toHaveValue('')
})

it('dispatches a /skill-name command that launches a run', async () => {
  vi.stubGlobal('fetch', answer(200, { kind: 'run', run_id: 'abc123' }))

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/planner analyse ceci' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => expect(screen.getByText(fr.chat.launched('planner'))).toBeInTheDocument())
})

it('nudges the open mission with a plain message', async () => {
  const fetchMock = answer(202, { status: 'queued' })
  vi.stubGlobal('fetch', fetchMock)

  render(<ConversationStone stateColour="var(--state-idle)" selectedRun={sampleRun} />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: 'bonjour' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => expect(screen.getByText(fr.chat.sentToRun('review'))).toBeInTheDocument())
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/runs/r1/nudge')
  expect(JSON.parse(init.body as string)).toEqual({ key: 'message', value: 'bonjour' })
})

it('explains that a plain message needs an open mission', async () => {
  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: 'bonjour' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => expect(screen.getByText(fr.chat.needsATarget)).toBeInTheDocument())
})

it('asks for confirmation before dispatching a -auto command, without dispatching yet', async () => {
  const fetchMock = answer(200, { kind: 'run', run_id: 'abc123' })
  vi.stubGlobal('fetch', fetchMock)

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/community-management-agency-auto publie ceci' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() =>
    expect(screen.getByRole('dialog', { name: fr.chat.autoConfirmTitle })).toBeInTheDocument(),
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

it('dispatches the -auto command only after explicit confirmation', async () => {
  const fetchMock = answer(200, { kind: 'run', run_id: 'abc123' })
  vi.stubGlobal('fetch', fetchMock)

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/community-management-agency-auto publie ceci' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  const dialog = await screen.findByRole('dialog', { name: fr.chat.autoConfirmTitle })

  fireEvent.click(within(dialog).getByRole('button', { name: fr.chat.autoConfirmConfirm }))

  await waitFor(() =>
    expect(screen.getByText(fr.chat.launched('community-management-agency-auto'))).toBeInTheDocument(),
  )
  expect(fetchMock).toHaveBeenCalled()
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/dispatch')
  expect(JSON.parse(init.body as string)).toEqual({
    skill: 'community-management-agency-auto',
    text: 'publie ceci',
  })
})

it('cancels a -auto command without dispatching, keeping the message for editing', async () => {
  const fetchMock = answer(200, { kind: 'run', run_id: 'abc123' })
  vi.stubGlobal('fetch', fetchMock)

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/community-management-agency-auto publie ceci' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  const dialog = await screen.findByRole('dialog', { name: fr.chat.autoConfirmTitle })

  fireEvent.click(within(dialog).getByRole('button', { name: fr.chat.autoConfirmCancel }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(input).toHaveValue('/community-management-agency-auto publie ceci')
})

it('dispatches a non--auto command immediately, with no confirmation step', async () => {
  const fetchMock = answer(200, { kind: 'run', run_id: 'abc123' })
  vi.stubGlobal('fetch', fetchMock)

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/community-management-agency publie ceci' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() =>
    expect(screen.getByText(fr.chat.launched('community-management-agency'))).toBeInTheDocument(),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('lists the known skills when a command names one that does not exist', async () => {
  vi.stubGlobal('fetch', answer(404, { error: 'unknown skill', known: ['heartbeat', 'planner'] }))

  render(<ConversationStone stateColour="var(--state-idle)" />)
  const input = screen.getByPlaceholderText(fr.chat.placeholder)

  fireEvent.change(input, { target: { value: '/jamais' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() =>
    expect(screen.getByText(fr.chat.unknownSkill(['heartbeat', 'planner']))).toBeInTheDocument(),
  )
})
