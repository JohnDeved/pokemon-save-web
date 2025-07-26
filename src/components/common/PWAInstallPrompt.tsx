import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Store the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    await deferredPrompt.prompt()

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice

    console.log(`User ${outcome} the install prompt`)

    // Reset the deferred prompt variable
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDeferredPrompt(null)
  }

  if (!showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Download className="w-6 h-6 text-blue-400"/>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-slate-100">
              Install Pokemon Save Editor
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              Get the full app experience with offline support and faster loading.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            Install
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            size="sm"
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
