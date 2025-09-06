import { useEffect, useState } from 'react'
import { clearRecents, listRecents, type RecentEntry } from '@/lib/recentFiles'
import { useSaveFileStore } from '@/stores'

export function useRecentFiles() {
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)

  const refresh = async () => {
    setLoading(true)
    try {
      const items = await listRecents()
      setRecents(items)
    } finally {
      setLoading(false)
    }
  }

  const clear = async () => {
    await clearRecents()
    await refresh()
  }

  useEffect(() => {
    void refresh()
    // refresh whenever a new file session begins (open/clear)
  }, [saveSessionId])

  return { recents, loading, refresh, clear }
}

