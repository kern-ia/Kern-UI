import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './ConversationStone.module.css'
import { fr } from '../i18n/fr'
import { dispatch, nudge, SteerError } from '../steer/api'
import type { Run } from '../runs/types'
import {
  clampStone,
  defaultStone,
  dockOnRelease,
  nextDock,
  EDGE_MARGIN,
  STONE_SIZE,
  type Bounds,
  type StonePosition,
} from './stone'

const STORAGE_KEY = 'kern-ui.stone'

/**
 * The floating conversation, as in the mockup: a rune stone you grab to move the bubble
 * around, and drop against either edge to tidy the bubble away.
 *
 * Two departures from the mockup, both deliberate:
 * pointer events rather than mouse events, so it works under a finger as well as a cursor;
 * and a keyboard path, because a control you can only drag is a control some people simply
 * cannot use.
 */
export function ConversationStone({
  stateColour,
  selectedRun = null,
}: {
  stateColour: string
  /** The mission a plain message nudges. A `/skill-name` command needs none. */
  selectedRun?: Run | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<StonePosition | null>(readStored)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  // A "-auto" skill (community-management-agency-auto, and any future skill following
  // that naming convention) skips human validation downstream — this is the one explicit
  // confirmation step before it can dispatch at all, distinct from that per-node approval.
  const [pendingAuto, setPendingAuto] = useState<{ command: string; skillText: string } | null>(null)
  const grabOffset = useRef({ x: 0, y: 0 })

  // Pointer handlers must read the live drag state, not the value captured when they were
  // created: a burst of moves can arrive before React re-renders, and every one of them
  // would be dropped. State drives the styling, refs drive the arithmetic.
  const draggingRef = useRef(false)
  const positionRef = useRef<StonePosition | null>(position)

  const place = useCallback((next: StonePosition) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  // The reserved band comes from CSS rather than from a breakpoint repeated here: the width
  // at which the navigation moves to the bottom is decided once, beside the rule that moves
  // it. Duplicating it in JS is how the two drift apart.
  const bottomInset = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--stone-bottom-inset')
    return Number.parseFloat(raw) || 0
  }

  const bounds = useCallback((): Bounds | null => {
    const parent = containerRef.current?.parentElement
    if (!parent) return null
    const rect = parent.getBoundingClientRect()
    return { width: rect.width, height: rect.height, bottomInset: bottomInset() }
  }, [])

  const originOf = useCallback((): DOMRect | null => {
    return containerRef.current?.parentElement?.getBoundingClientRect() ?? null
  }, [])

  // The default position depends on the container, so it can only be computed once mounted.
  //
  // A restored position is clamped rather than trusted: it may have been stored on a wide
  // screen and be impossible on this one — below the navigation, or past the right edge —
  // and a stone nobody can see is a stone nobody can move back.
  useEffect(() => {
    const b = bounds()
    if (!b) return

    const current = positionRef.current
    if (current === null) {
      place(defaultStone(b))
      return
    }
    const inside = clampStone(current.x, current.y, b)
    if (inside.x !== current.x || inside.y !== current.y) {
      place({ ...current, ...inside })
    }
  }, [bounds, place])

  useEffect(() => {
    if (position) writeStored(position)
  }, [position])

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = originOf()
    const current = positionRef.current
    if (!origin || !current) return

    event.preventDefault()
    // Capture keeps the moves coming even when the cursor outruns the stone. Some engines
    // refuse it for synthetic pointers; dragging still works without it.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* not fatal */
    }

    grabOffset.current = {
      x: event.clientX - origin.left - current.x,
      y: event.clientY - origin.top - current.y,
    }
    draggingRef.current = true
    setDragging(true)
    place({ ...current, docked: null })
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return
    const b = bounds()
    const origin = originOf()
    if (!b || !origin) return

    const next = clampStone(
      event.clientX - origin.left - grabOffset.current.x,
      event.clientY - origin.top - grabOffset.current.y,
      b,
    )
    place({ ...next, docked: null })
  }

  const onPointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)

    const b = bounds()
    const current = positionRef.current
    if (!b || !current) return
    place({ ...current, ...dockOnRelease(current.x, b) })
  }

  const toggleDock = () => {
    const b = bounds()
    const current = positionRef.current
    if (!b || !current) return

    const docked = nextDock(current.docked)
    const x = docked === 'left' ? EDGE_MARGIN : docked === 'right' ? b.width - STONE_SIZE : defaultStone(b).x
    place({ ...current, x, docked })
  }

  const docked = position?.docked ?? null
  const label = docked ? fr.chat.stoneShow : fr.chat.stoneHide

  const dispatchCommand = async (command: string, skillText: string) => {
    setSending(true)
    setFeedback(null)
    try {
      setFeedback(fr.chat.launching)
      const result = await dispatch(command, skillText)
      setFeedback(
        result.kind === 'tool' && result.result
          ? `${result.result.label} : ${result.result.value}`
          : fr.chat.launched(command),
      )
      setMessage('')
    } catch (err) {
      if (err instanceof SteerError && err.known) {
        setFeedback(fr.chat.unknownSkill(err.known))
      } else {
        setFeedback(fr.chat.sendFailed)
      }
    } finally {
      setSending(false)
    }
  }

  // `/skill-name texte…` dispatches a compétence — no mission needed. Anything else nudges
  // the mission currently open; with none open, there is nothing honest to do with it. A
  // "-auto" command pauses here for confirmDialog instead of dispatching straight away.
  const submit = async () => {
    const text = message.trim()
    if (text === '' || sending) return

    if (text.startsWith('/')) {
      const [command, ...rest] = text.slice(1).split(/\s+/)
      const skillText = rest.join(' ')
      if (command.endsWith('-auto')) {
        setPendingAuto({ command, skillText })
        return
      }
      await dispatchCommand(command, skillText)
      return
    }

    if (!selectedRun) {
      setFeedback(fr.chat.needsATarget)
      return
    }
    setSending(true)
    setFeedback(null)
    try {
      await nudge(selectedRun.id, 'message', text)
      setFeedback(fr.chat.sentToRun(selectedRun.graph))
      setMessage('')
    } catch {
      setFeedback(fr.chat.sendFailed)
    } finally {
      setSending(false)
    }
  }

  const confirmAuto = async () => {
    if (!pendingAuto) return
    const { command, skillText } = pendingAuto
    setPendingAuto(null)
    await dispatchCommand(command, skillText)
  }

  const cancelAuto = () => setPendingAuto(null)

  return (
    <div
      ref={containerRef}
      className={styles.group}
      data-dragging={dragging}
      data-docked={docked ?? 'none'}
      style={{ left: position?.x ?? 0, top: position?.y ?? 0 }}
    >
      <button
        type="button"
        className={styles.stone}
        data-dragging={dragging}
        aria-label={label}
        title={label}
        aria-pressed={docked !== null}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleDock()
          }
        }}
      >
        <span className={styles.rune} aria-hidden="true">
          ᛝ
        </span>
      </button>

      {/* Docked means tidied away: the bubble goes, the stone stays reachable. */}
      {docked === null && (
        <div
          className={styles.bubble}
          style={{ '--bubble-border': `${stateColour}` } as React.CSSProperties}
        >
          <span
            className={styles.dot}
            style={{ '--dot-colour': stateColour } as React.CSSProperties}
            aria-hidden="true"
          />
          <input
            className={styles.field}
            placeholder={fr.chat.placeholder}
            value={message}
            disabled={sending}
            aria-describedby={feedback ? 'chat-note' : undefined}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
          />
          {feedback && (
            <p className={styles.note} id="chat-note" role="status">
              {feedback}
            </p>
          )}
        </div>
      )}

      {pendingAuto && (
        <div
          className={styles.autoConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={fr.chat.autoConfirmTitle}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelAuto()
          }}
        >
          <div className={styles.autoConfirmPanel}>
            <p className={styles.autoConfirmTitle}>{fr.chat.autoConfirmTitle}</p>
            <p className={styles.autoConfirmBody}>{fr.chat.autoConfirmBody(pendingAuto.command)}</p>
            <div className={styles.autoConfirmActions}>
              <button type="button" onClick={cancelAuto}>
                {fr.chat.autoConfirmCancel}
              </button>
              <button type="button" onClick={() => void confirmAuto()}>
                {fr.chat.autoConfirmConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function readStored(): StonePosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StonePosition) : null
  } catch {
    // Private browsing, quota, corrupt value: fall back to the default placement.
    return null
  }
}

function writeStored(position: StonePosition) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
  } catch {
    // Losing the placement is not worth an error on screen.
  }
}
