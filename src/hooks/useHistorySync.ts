import { useEffect } from 'react'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { useSaveFileStore } from '@/stores/useSaveFileStore'

export function useHistorySync() {
  const hasFile = useSaveFileStore(s => s.hasFile)
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const parser = useSaveFileStore(s => s.parser)
  const saveFileName = useSaveFileStore(s => s.parser?.saveFileName)

  useEffect(() => {
    const historyStore = useHistoryStore.getState()
    if (!hasFile) {
      historyStore.clear()
      return
    }
    if (!historyStore.isApplying) {
      historyStore.initFromCurrent()
    }
  }, [hasFile, parser, saveFileName, saveSessionId])
}
