import { AnimatePresence, motion, useMotionValue } from 'framer-motion'
import { Mouse as MouseIcon } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

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
 * - Positions above the cursor with configurable offsets.
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
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* This wrapper centers horizontally and sits above the cursor */}
          <div className="transform -translate-x-1/2 -translate-y-full">
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
  const [overflowOk, setOverflowOk] = useState(!requireOverflow)

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
    }
    const onLeave = () => setHovered(false)
    const onWheel = () => {
      if (once && !ack) {
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
      root.removeEventListener('wheel', onWheel as EventListener)
    }
  }, [anchorRef, enabled, hovered, updateFromEvent, once, ack, onAcknowledge])

  useEffect(() => {
    // If overflow isn't required, we're always okay.
    if (!requireOverflow) {
      setOverflowOk(true)
      return
    }

    const el = targetRef?.current
    if (!el) {
      // No target to check yet; allow visibility until it mounts.
      setOverflowOk(true)
      return
    }

    const check = () => {
      // Small epsilon to avoid off-by-one due to subpixel layout.
      setOverflowOk(el.scrollHeight - el.clientHeight > 1)
    }

    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [targetRef, requireOverflow])

  const visible = enabled && hovered && !ack && overflowOk
  const style = { x, y }

  return { visible, style, x, y, acknowledge: () => setAck(true) }
}
