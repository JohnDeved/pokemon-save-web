import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card'

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
    await deferredPrompt.userChoice

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
      <Card className="bg-slate-800/95 backdrop-blur-sm border-slate-700 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <CardTitle className="text-slate-100 text-sm font-medium">
                Install Pokemon Save Editor
              </CardTitle>
              <CardDescription className="text-slate-300 text-sm mt-1">
                Get the full app experience with offline support and faster loading.
              </CardDescription>
            </div>
            <CardAction>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleDismiss}
                className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm"
              size="sm"
            >
              Install
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 hover:bg-slate-700 text-sm"
              size="sm"
            >
              Not now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
