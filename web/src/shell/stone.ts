/**
 * Position logic for the conversation stone, lifted from
 * design/mockups/Agentic OS.dc.html: the stone is the handle, the conversation bubble
 * rides beside it, and docking against an edge tidies the bubble away.
 */

/** Diameter of the stone, plus the margin kept against the container edges. */
export const STONE_SIZE = 48
export const EDGE_MARGIN = 4

/** How close to an edge a release must land to dock. */
export const DOCK_THRESHOLD = 70

export type Dock = 'left' | 'right' | null

export interface Bounds {
  width: number
  height: number
  /**
   * Height of a band at the bottom the stone must stay clear of.
   *
   * On a phone the navigation lives there and shares this container. Without it the stone
   * parks on top of the tabs and the whole interface becomes unreachable. The value comes
   * from CSS — see `--stone-bottom-inset` — so the width at which it applies is decided in
   * one place, beside the media query that moves the navigation.
   */
  bottomInset?: number
}

export interface StonePosition {
  x: number
  y: number
  docked: Dock
}

/** Where the stone sits before anyone moves it: bottom centre, bubble showing. */
export function defaultStone(bounds: Bounds): StonePosition {
  return {
    x: Math.max(EDGE_MARGIN, bounds.width / 2 - 130),
    y: Math.max(EDGE_MARGIN, bounds.height - 90 - (bounds.bottomInset ?? 0)),
    docked: null,
  }
}

/** Keeps a dragged position inside the container. */
export function clampStone(x: number, y: number, bounds: Bounds): { x: number; y: number } {
  const floor = bounds.height - (bounds.bottomInset ?? 0) - STONE_SIZE
  return {
    x: Math.max(EDGE_MARGIN, Math.min(x, bounds.width - STONE_SIZE)),
    // The outer max wins when the reserved band is taller than the container: better a
    // stone overlapping the navigation than one pushed off the top of the screen.
    y: Math.max(EDGE_MARGIN, Math.min(y, floor)),
  }
}

/** Decides whether a release docks the stone, and snaps it flush if so. */
export function dockOnRelease(x: number, bounds: Bounds): { x: number; docked: Dock } {
  if (x < DOCK_THRESHOLD) {
    return { x: EDGE_MARGIN, docked: 'left' }
  }
  if (x > bounds.width - DOCK_THRESHOLD - 44) {
    return { x: bounds.width - STONE_SIZE, docked: 'right' }
  }
  return { x, docked: null }
}

/**
 * Dragging needs a pointer, so the keyboard gets a cycle instead: free, tidied right,
 * tidied left, and back. Without it the stone would be unreachable without a mouse.
 */
export function nextDock(current: Dock): Dock {
  if (current === null) return 'right'
  if (current === 'right') return 'left'
  return null
}
