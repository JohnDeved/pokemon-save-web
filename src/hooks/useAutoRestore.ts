import { useEffect, useRef, useState } from 'react'
import { listRecents } from '@/lib/recentFiles'
import { hasFsPermissions } from '@/types/fs'
import type { SaveFileStore } from '@/stores'

interface UseAutoRestoreOptions {
  parse: SaveFileStore['parse']
  suppressAutoRestore: boolean
}

export function useAutoRestore({ parse, suppressAutoRestore }: UseAutoRestoreOptions) {
  const [attemptingRestore, setAttemptingRestore] = useState(true)
  const triedRestore = useRef(false)

  useEffect(() => {
    if (triedRestore.current) return
    triedRestore.current = true
    let cancelled = false

    ;(async () => {
      try {
        if (suppressAutoRestore) return
        const items = await listRecents()
        const [first] = items
        if (!first) return
        const { handle } = first

        if (hasFsPermissions(handle) && typeof handle.queryPermission === 'function') {
          let status = await handle.queryPermission({ mode: 'read' })
          if (status !== 'granted' && typeof handle.requestPermission === 'function') {
            try {
              status = await handle.requestPermission({ mode: 'read' })
            } catch {
              return
            }
          }
          if (status !== 'granted') return
        }

        await parse(handle)
      } catch (error) {
        console.warn('Auto-restore last file failed:', error)
      } finally {
        if (!cancelled) setAttemptingRestore(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [parse, suppressAutoRestore])

  return attemptingRestore
}
