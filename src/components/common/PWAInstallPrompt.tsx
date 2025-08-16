import { Button } from '@/components/ui/button'
import { HiOutlineCloudDownload } from 'react-icons/hi'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissedForDev, setDismissedForDev] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Store the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Debug: Simulate the prompt on localhost if not already shown and not dismissed (session only)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost && !deferredPrompt && !showPrompt && !dismissedForDev) {
      // Fake BeforeInstallPromptEvent for debug
      const fakePrompt: BeforeInstallPromptEvent = {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'accepted' }),
        ...new Event('beforeinstallprompt'),
      }
      setDeferredPrompt(fakePrompt)
      setShowPrompt(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [deferredPrompt, showPrompt])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    await deferredPrompt.prompt()

    // Wait for the user to respond
    await deferredPrompt.userChoice

    // Reset the deferred prompt variable
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDeferredPrompt(null)
    // Remember dismissal for the session only (state)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setDismissedForDev(true)
    }
  }

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
        <motion.div
          className='fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm'
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className='bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg'>
            <div className='flex items-start gap-2'>
              <div className='flex-shrink-0'>
                <HiOutlineCloudDownload className='w-5 h-5 text-blue-400' />
              </div>
              <div className='flex-1 min-w-0'>
                <h3 className='text-sm font-medium text-slate-100'>
                  Install Pokemon Save Editor
                </h3>
                <p className='text-xs text-slate-300 mt-1'>
                  Get the full app experience with offline support and faster loading.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className='flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mt-1 -mr-1'
              >
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            <div className='flex gap-2 mt-2'>
              <Button
                onClick={handleInstall}
                className='flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors border-0 min-h-[44px]'
                type='button'
              >
                Install
              </Button>
              <Button
                onClick={handleDismiss}
                variant='outline'
                className='flex-1 px-3 py-2 border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 rounded text-sm transition-colors min-h-[44px]'
                type='button'
              >
                Not now
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
