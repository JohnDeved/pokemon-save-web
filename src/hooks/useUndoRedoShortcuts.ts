import { useEffect } from 'react'

type UndoRedo = () => Promise<void> | void

interface UseUndoRedoShortcutsOptions {
  undo: UndoRedo
  redo: UndoRedo
}

export function useUndoRedoShortcuts({ undo, redo }: UseUndoRedoShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) void redo()
        else void undo()
      } else if (key === 'y') {
        e.preventDefault()
        void redo()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}
