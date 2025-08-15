import { useSaveFileStore } from '../stores'

/**
 * Compatibility hook that uses Zustand store but maintains the same API as the original hook.
 */
export const useSaveFileParser = () => {
  return useSaveFileStore()
}