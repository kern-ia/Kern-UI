import { DOCK_THRESHOLD, clampStone, defaultStone, dockOnRelease, nextDock } from './stone'

const bounds = { width: 1000, height: 600 }

it('starts near the bottom centre, undocked', () => {
  const stone = defaultStone(bounds)

  expect(stone.docked).toBeNull()
  expect(stone.x).toBeGreaterThan(0)
  expect(stone.x).toBeLessThan(bounds.width)
  expect(stone.y).toBeLessThan(bounds.height)
})

it('keeps the stone inside its container', () => {
  expect(clampStone(-500, -500, bounds)).toEqual({ x: 4, y: 4 })

  const far = clampStone(99999, 99999, bounds)
  expect(far.x).toBeLessThanOrEqual(bounds.width - 48)
  expect(far.y).toBeLessThanOrEqual(bounds.height - 48)
})

it('docks left when released near the left edge', () => {
  expect(dockOnRelease(DOCK_THRESHOLD - 1, bounds)).toEqual({ x: 4, docked: 'left' })
})

it('docks right when released near the right edge', () => {
  const { docked, x } = dockOnRelease(bounds.width - 40, bounds)

  expect(docked).toBe('right')
  expect(x).toBe(bounds.width - 48)
})

it('stays free in the middle', () => {
  expect(dockOnRelease(500, bounds)).toEqual({ x: 500, docked: null })
})

// Dragging is impossible with a keyboard, so the stone must be tidy-able without a pointer.
it('cycles dock states for keyboard users', () => {
  expect(nextDock(null)).toBe('right')
  expect(nextDock('right')).toBe('left')
  expect(nextDock('left')).toBeNull()
})
