import {
  DOCK_THRESHOLD,
  EDGE_MARGIN,
  STONE_SIZE,
  clampStone,
  defaultStone,
  dockOnRelease,
  nextDock,
} from './stone'

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

// On a phone the navigation sits at the bottom of the shell, and the stone shares that
// container. Without a reserved band it parks on top of the navigation and makes the whole
// interface unreachable — which is exactly what a screenshot at 375px showed.
describe('the band reserved at the bottom', () => {
  it('keeps the default position above it', () => {
    const withNav = defaultStone({ width: 375, height: 667, bottomInset: 64 })
    const without = defaultStone({ width: 375, height: 667 })

    expect(withNav.y).toBe(without.y - 64)
  })

  it('stops a drag from reaching it', () => {
    const { y } = clampStone(10, 9999, { width: 375, height: 667, bottomInset: 64 })

    expect(y).toBe(667 - 64 - STONE_SIZE)
  })

  // A band taller than the container must not push the stone off the top edge.
  it('never pushes the stone out of the top', () => {
    const { y } = clampStone(10, 9999, { width: 375, height: 80, bottomInset: 400 })

    expect(y).toBeGreaterThanOrEqual(EDGE_MARGIN)
  })

  it('changes nothing when no band is reserved', () => {
    expect(clampStone(10, 9999, { width: 375, height: 667 }).y).toBe(667 - STONE_SIZE)
  })
})

// A position stored on a wide screen can be impossible on a narrow one: below the reserved
// band, or past the right edge. Restoring it as-is loses the stone behind the navigation,
// which is what happened the first time the mobile layout was actually looked at.
describe('a position restored from a previous visit', () => {
  it('is brought back inside a smaller container', () => {
    const stored = { x: 900, y: 640 }

    const { x, y } = clampStone(stored.x, stored.y, {
      width: 375,
      height: 667,
      bottomInset: 64,
    })

    expect(x).toBeLessThanOrEqual(375 - STONE_SIZE)
    expect(y).toBeLessThanOrEqual(667 - 64 - STONE_SIZE)
  })
})
