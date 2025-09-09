import { AnimatePresence, motion, useMotionValue } from 'framer-motion'
import { Mouse as MouseIcon } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
 * - Uses springs for smooth following.
 * - Pointer-events are disabled so it never intercepts input.
 */
export function CursorFollowHint({
  anchorRef,
  targetRef,
  enabled = true,
  label = 'Scroll',
  offsetX = 0,
  offsetY = -24,
  className,
  contentClassName = 'geist-font text-[11px]',
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

  const Icon = useMemo(() => icon ?? <MouseIcon className="w-3.5 h-3.5" strokeWidth={2} />, [icon])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={['pointer-events-none absolute z-[60] text-muted-foreground/90 geist-font', className]
            .filter(Boolean)
            .join(' ')}
          style={{ ...style, left: 0, top: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={[
              'bg-popover/90 shadow-sm border border-border/60 rounded px-2 py-1 flex items-center gap-1.5 text-[11px] whitespace-nowrap',
              contentClassName,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {Icon}
            {label}
          </motion.div>
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
  offsetX = 0,
  offsetY = -24,
  once = true,
  onAcknowledge,
  requireOverflow = true,
}: UseCursorFollowOptions) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [hovered, setHovered] = useState(false)
  const [ack, setAck] = useState(false)
  const [hasOverflow, setHasOverflow] = useState<boolean>(false)
  const [measured, setMeasured] = useState<boolean>(false)
  const [hasPosition, setHasPosition] = useState(false)

  const updateFromEvent = useCallback(
    (e: MouseEvent | PointerEvent) => {
      const root = anchorRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const nx = e.clientX - rect.left + offsetX
      const ny = e.clientY - rect.top + offsetY
      x.set(nx)
      y.set(ny)
      if (!hasPosition) setHasPosition(true)
    },
    [anchorRef, offsetX, offsetY, x, y, hasPosition]
  )

  const onMove = useCallback(
    (e: MouseEvent) => {
      updateFromEvent(e)
      if (!hovered) setHovered(true)
    },
    [hovered, updateFromEvent]
  )

  const onEnter = useCallback(
    (e: Event) => {
      // If pointerenter contains coordinates (PointerEvent), snap immediately
      if ((e as PointerEvent).clientX !== null && (e as PointerEvent).clientX !== undefined)
        updateFromEvent(e as PointerEvent)
      setHovered(true)
    },
    [updateFromEvent]
  )
  const onLeave = useCallback(() => setHovered(false), [])
  const onWheel = useCallback(() => {
    if (once && !ack) {
      setAck(true)
      onAcknowledge?.()
    }
  }, [ack, once, onAcknowledge])

  useEffect(() => {
    const root = anchorRef.current
    if (!root || !enabled) return
    // Use pointer events when available for better device support
    const moveType = 'onpointermove' in globalThis ? 'pointermove' : 'mousemove'
    const enterType = 'onpointerenter' in globalThis ? 'pointerenter' : 'mouseenter'

    // Strongly-typed listeners
    const moveListener = onMove as (e: Event) => void
    const enterListener = onEnter as (e: Event) => void
    const leaveListener = onLeave as (e: Event) => void
    const wheelListener = onWheel as (e: Event) => void

    root.addEventListener(moveType, moveListener)
    root.addEventListener(enterType, enterListener)
    root.addEventListener('mouseleave', leaveListener)
    root.addEventListener('wheel', wheelListener, { passive: true })
    return () => {
      root.removeEventListener(moveType, moveListener)
      root.removeEventListener(enterType, enterListener)
      root.removeEventListener('mouseleave', leaveListener)
      root.removeEventListener('wheel', wheelListener)
    }
  }, [anchorRef, enabled, onEnter, onLeave, onMove, onWheel])

  const computeOverflow = useCallback(() => {
    const el = targetRef?.current
    if (!el) {
      setHasOverflow(false)
      setMeasured(false)
      return
    }
    setHasOverflow(el.scrollHeight - el.clientHeight > 1)
    setMeasured(true)
  }, [targetRef])

  useEffect(() => {
    if (!enabled) {
      setHasOverflow(false)
      return
    }
    computeOverflow()
    let ro: ResizeObserver | null = null
    if (targetRef?.current) {
      ro = new ResizeObserver(computeOverflow)
      ro.observe(targetRef.current)
    }
    window.addEventListener('resize', computeOverflow)

    // If target isn't mounted yet, poll via rAF until it is, then RO takes over
    let raf = 0
    const tick = () => {
      computeOverflow()
      if (!targetRef?.current) raf = requestAnimationFrame(tick)
    }
    if (!targetRef?.current) raf = requestAnimationFrame(tick)

    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', computeOverflow)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled, computeOverflow, targetRef])

  const overflowOk = !requireOverflow || (!targetRef?.current ? true : measured ? hasOverflow : true)
  const visible = enabled && hovered && !ack && overflowOk && hasPosition
  // Use raw MotionValues for immediate positioning; no spring to avoid slide-in.
  const style = { x, y }

  return { visible, style, x, y, acknowledge: () => setAck(true) }
}
