import { useCallback, useEffect, useRef, type WheelEventHandler } from 'react'

// Smooth wheel scrolling tailored for Mac trackpads and mouse wheels.
// - Trackpads (pixel deltas) are applied directly for precise control.
// - Mouse wheels (line/page deltas) use easing for a smoother feel.
// - We only prevent default when the inner scroller can actually move,
//   which avoids page "rubber-banding" or nudging.

interface Options {
  enabled?: boolean
}

interface AnyRef<T> {
  current: T | null
}

export function useSmoothWheelScroll(
  scrollRef: AnyRef<HTMLDivElement>,
  { enabled = true }: Options = {}
) {
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef<number | null>(null)
  const prefersReducedMotionRef = useRef(false)

  const LINE_HEIGHT_PX = 24
  const MOUSE_STEP_MAX_PX = 200

  useEffect(() => {
    try {
      prefersReducedMotionRef.current =
        globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    } catch {
      prefersReducedMotionRef.current = false
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const smoothScroll = useCallback((el: HTMLDivElement, delta: number) => {
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    const current = el.scrollTop
    const from = current
    const target = Math.max(0, Math.min(max, (targetRef.current ?? current) + delta))
    // For very small deltas (common on Mac trackpads), apply immediately
    // instead of cancelling the event. This avoids "no-op" scrolls where
    // default is prevented but our animation decides the delta is too small.
    if (Math.abs(target - current) < 0.5) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      el.scrollTop = target
      targetRef.current = target
      return true
    }

    if (prefersReducedMotionRef.current) {
      el.scrollTop = target
      targetRef.current = target
      return true
    }

    targetRef.current = target
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const distance = Math.abs(target - from)
    const duration = Math.min(400, 120 + distance * 0.25)
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - (1 - t) ** 3
      const targetNow = targetRef.current ?? from
      const next = from + (targetNow - from) * ease
      el.scrollTop = next
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = null
    }

    rafRef.current = requestAnimationFrame(tick)
    return true
  }, [])

  const onWheel = useCallback<WheelEventHandler<HTMLDivElement>>(
    e => {
      if (!enabled) return
      const el = scrollRef.current
      if (!el) return

      // Normalize delta units (always use vertical component)
      const dm = e.deltaMode
      let dy = e.deltaY
      if (dm === 1) dy *= LINE_HEIGHT_PX
      else if (dm === 2) dy *= el.clientHeight

      if (dy === 0) return

      // Determine if the inner scroller can actually move on this event
      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      const from = el.scrollTop
      const predicted = Math.max(0, Math.min(max, from + dy))
      const willScroll = predicted !== from

      if (!willScroll) return // let the page handle it

      // We will handle this scroll fully to keep control and avoid page nudge
      e.preventDefault()
      e.stopPropagation()

      // For pixel deltas (trackpads), apply directly for tight control
      if (dm === 0) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        el.scrollTop = predicted
        targetRef.current = predicted
        return
      }

      // For wheel mice (line/page deltas), use smoothing
      const step = Math.sign(dy) * Math.min(MOUSE_STEP_MAX_PX, Math.abs(dy))
      void smoothScroll(el, step)
    },
    [enabled, scrollRef, smoothScroll]
  )

  return { onWheel }
}
