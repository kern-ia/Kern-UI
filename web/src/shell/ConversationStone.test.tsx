import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { ConversationStone } from './ConversationStone'
import { fr } from '../i18n/fr'

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
