import { useState, useEffect } from 'react'

/**
 * Hook to detect mobile/desktop breakpoints
 * Returns true for mobile/tablet, false for desktop
 * Uses the same breakpoint as the original CSS (lg: 1024px)
 */
export const useBreakpoint = () => {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize based on current window size
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024
  })
  
  useEffect(() => {
    const checkBreakpoint = () => {
      const newIsMobile = window.innerWidth < 1024
      setIsMobile(newIsMobile)
    }
    
    // Listen for window resize
    window.addEventListener('resize', checkBreakpoint)
    
    // Check immediately in case the window was resized before the hook ran
    checkBreakpoint()
    
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [])
  
  return { isMobile }
}