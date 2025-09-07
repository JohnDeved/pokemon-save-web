import { useCallback, useEffect, useRef, type WheelEventHandler } from 'react'

interface Options {
  enabled?: boolean
}

interface AnyRef<T> {
  current: T | null
}

export function useSmoothWheelScroll(scrollRef: AnyRef<HTMLDivElement>, { enabled = true }: Options = {}) {
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef<number | null>(null)
  const prefersReducedMotionRef = useRef(false)

  useEffect(() => {
    try {
      prefersReducedMotionRef.current = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
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
    if (Math.abs(target - current) < 0.5) return false

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
      const next = from + (targetRef.current! - from) * ease
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

      // Normalize delta units and clamp
      let dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) || e.shiftKey ? e.deltaY : 0
      const dm = e.deltaMode
      if (dm === 1) dy *= 24
      else if (dm === 2) dy *= el.clientHeight
      const sign = Math.sign(dy || 1)
      const deltaY = sign * Math.min(200, Math.abs(dy))
      if (deltaY === 0) return

      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      const predicted = Math.max(0, Math.min(max, el.scrollTop + deltaY))
      const atEdge = (deltaY < 0 && el.scrollTop <= 0) || (deltaY > 0 && Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight)
      const willScroll = predicted !== el.scrollTop && !atEdge

      if (willScroll) {
        e.preventDefault()
        e.stopPropagation()
        void smoothScroll(el, deltaY)
      }
    },
    [enabled, scrollRef, smoothScroll]
  )

  return { onWheel }
}
