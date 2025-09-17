import { useEffect } from 'react'
import { useHistoryStore } from '@/stores/useHistoryStore'

interface UseHistorySyncOptions {
  hasFile: boolean
  parser: unknown
  saveFileName?: string | null
}

export function useHistorySync({ hasFile, parser, saveFileName }: UseHistorySyncOptions) {
  useEffect(() => {
    const historyStore = useHistoryStore.getState()
    if (!hasFile) {
      historyStore.clear()
      return
    }
    if (!historyStore.isApplying) {
      historyStore.initFromCurrent()
    }
  }, [hasFile, parser, saveFileName])
}
