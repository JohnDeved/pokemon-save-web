import { AnimatePresence, motion, useMotionValue } from 'framer-motion'
import { Mouse as MouseIcon } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface CursorFollowHintProps {
  anchorRef: React.RefObject<HTMLElement | null>
  targetRef?: React.RefObject<HTMLElement | null>
  enabled?: boolean
  label?: React.ReactNode
  offsetX?: number
  offsetY?: number
  className?: string
  contentClassName?: string
  icon?: React.ReactNode
  once?: boolean
  onAcknowledge?: () => void
  /** If true, only show when targetRef is scrollable; otherwise ignore overflow. */
  requireOverflow?: boolean
}

/**
 * Lightweight cursor-follow hint that renders inside the given anchor element.
 * - Positions above the cursor (centered) with configurable offsets.
 * - Pointer-events are disabled so it never intercepts input.
 */
export function CursorFollowHint({
  anchorRef,
  targetRef,
  enabled = true,
  label = 'Scroll',
  offsetX = 0,
  offsetY = -10,
  className,
  contentClassName,
  icon,
  once = true,
  onAcknowledge,
  requireOverflow = true,
}: CursorFollowHintProps) {
  const { visible, style } = useCursorFollow({
    anchorRef,
    targetRef,
    enabled,
    offsetX,
    offsetY,
    once,
    onAcknowledge,
    requireOverflow,
  })

  const IconEl = icon ?? <MouseIcon className="w-3.5 h-3.5" strokeWidth={2} />

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`pointer-events-none absolute z-[60] text-muted-foreground/90 geist-font ${className ?? ''}`}
          style={{ left: 0, top: 0, x: style.x, y: style.y }} // motion translate to cursor
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Center horizontally and sit above the cursor */}
          <div className="-translate-x-1/2 -translate-y-full">
            <div
              className={`bg-popover/90 shadow-sm border border-border/60 rounded px-2 py-1 flex items-center gap-1.5 text-[11px] whitespace-nowrap ${contentClassName ?? ''}`}
            >
              {IconEl}
              {label}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook: Encapsulates cursor-follow logic and returns Motion style bindings and visibility
export interface UseCursorFollowOptions {
  anchorRef: React.RefObject<HTMLElement | null>
  targetRef?: React.RefObject<HTMLElement | null>
  enabled?: boolean
  offsetX?: number
  offsetY?: number
  once?: boolean
  onAcknowledge?: () => void
  requireOverflow?: boolean
}

export function useCursorFollow({
  anchorRef,
  targetRef,
  enabled = true,
  offsetX = 12,
  offsetY = -36,
  once = true,
  onAcknowledge,
  requireOverflow = true,
}: UseCursorFollowOptions) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const [hovered, setHovered] = useState(false)
  const [ack, setAck] = useState(false)
  // Start false when overflow is required; set true only after confirmed.
  const [overflowOk, setOverflowOk] = useState<boolean>(!requireOverflow)

  // Keep latest ack in a ref to avoid re-subscribing listeners.
  const ackRef = useRef(ack)
  useEffect(() => {
    ackRef.current = ack
  }, [ack])

  const updateFromEvent = useCallback(
    (e: PointerEvent) => {
      const root = anchorRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      x.set(e.clientX - rect.left + offsetX)
      y.set(e.clientY - rect.top + offsetY)
    },
    [anchorRef, offsetX, offsetY, x, y]
  )

  // Compute/refresh overflow status
  const checkOverflow = useCallback(() => {
    if (!requireOverflow) {
      setOverflowOk(true)
      return true
    }
    const el = targetRef?.current
    if (!el) {
      setOverflowOk(false)
      return false
    }
    const hasOverflow = el.scrollHeight - el.clientHeight > 1 // epsilon against subpixel
    setOverflowOk(hasOverflow)
    return hasOverflow
  }, [requireOverflow, targetRef])

  // Pointer tracking within the anchor
  useEffect(() => {
    const root = anchorRef.current
    if (!root || !enabled) return

    const onMove = (e: PointerEvent) => {
      updateFromEvent(e)
      if (!hovered) setHovered(true)
    }
    const onEnter = (e: PointerEvent) => {
      updateFromEvent(e)
      setHovered(true)
      // Re-check overflow on every enter to avoid stale state
      checkOverflow()
    }
    const onLeave = () => setHovered(false)

    // Acknowledge with wheel only when not requiring target overflow or no target present
    const onWheel: EventListener = () => {
      const shouldAckViaWheel = !requireOverflow || !targetRef?.current
      if (once && !ackRef.current && shouldAckViaWheel) {
        setAck(true)
        onAcknowledge?.()
      }
    }

    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('wheel', onWheel)
    }
  }, [anchorRef, enabled, hovered, updateFromEvent, once, onAcknowledge, requireOverflow, targetRef, checkOverflow])

  // Observe overflow changes
  useEffect(() => {
    if (!enabled) return

    // If overflow isn't required, allow and skip wiring observers.
    if (!requireOverflow) {
      setOverflowOk(true)
      return
    }

    const el = targetRef?.current
    if (!el) {
      setOverflowOk(false)
      return
    }

    const handle = () => checkOverflow()

    // Initial measurement
    handle()

    const ro = 'ResizeObserver' in window ? new ResizeObserver(handle) : null
    ro?.observe(el)

    const mo = new MutationObserver(handle)
    mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true })

    window.addEventListener('resize', handle)

    return () => {
      ro?.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requireOverflow, targetRef, checkOverflow])

  // Acknowledge when the actual scrollable target scrolls (only when required)
  useEffect(() => {
    if (!enabled || !requireOverflow) return
    const el = targetRef?.current
    if (!el) return

    const onScroll: EventListener = () => {
      if (once && !ackRef.current) {
        setAck(true)
        onAcknowledge?.()
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [enabled, requireOverflow, targetRef, once, onAcknowledge])

  // Reset hover when disabled toggles off
  useEffect(() => {
    if (!enabled) setHovered(false)
  }, [enabled])

  const visible = enabled && hovered && !ack && overflowOk
  const style = { x, y }

  return { visible, style, x, y, acknowledge: () => setAck(true) }
}
