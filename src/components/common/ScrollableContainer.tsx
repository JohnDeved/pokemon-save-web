import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { setRef } from '@/lib/reactRef'
import { cn } from '../../lib/utils'

interface ScrollableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

type ScrollState = 'none' | 'top' | 'bottom' | 'both'

const fadeClassMap: Record<ScrollState, string> = {
  top: 'scroll-fade-top',
  bottom: 'scroll-fade-bottom',
  both: 'scroll-fade-both',
  none: '',
}

// Scrollable container with dynamic fade effects
export const ScrollableContainer = React.forwardRef<HTMLDivElement, ScrollableContainerProps>(function ScrollableContainer({ children, className, ...rest }, forwardedRef) {
  const [scrollState, setScrollState] = useState<ScrollState>('none')
  const containerRef = useRef<HTMLDivElement>(null)

  const checkScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) {
      setScrollState('none')
      return
    }
    if (el.scrollHeight <= el.clientHeight) {
      setScrollState('none')
      return
    }
    const atTop = el.scrollTop === 0
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1
    if (!atTop && !atBottom) {
      setScrollState('both')
      return
    }
    if (atTop && !atBottom) {
      setScrollState('bottom')
      return
    }
    if (!atTop && atBottom) {
      setScrollState('top')
      return
    }
    setScrollState('none')
  }, [])

  useLayoutEffect(() => {
    checkScroll()
  }, [checkScroll, children])

  useEffect(() => {
    const el = containerRef.current
    el?.addEventListener('scroll', checkScroll)
    globalThis.addEventListener('resize', checkScroll)
    return () => {
      el?.removeEventListener('scroll', checkScroll)
      globalThis.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  return (
    <div
      ref={node => {
        containerRef.current = node
        setRef(forwardedRef, node)
      }}
      className={cn('scroll-container geist-font', className, fadeClassMap[scrollState])}
      {...rest}
    >
      {children}
    </div>
  )
})
