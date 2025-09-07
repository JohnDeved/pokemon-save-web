import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BeforeInstallPromptEvent } from '@/types/pwa'

export interface UISettingsState {
  shaderEnabled: boolean
  theme: 'zinc' | 'slate'
  // When true, suppress auto-restore of last used save across reloads
  suppressAutoRestore: boolean
  pwaInstall:
    | {
        dismissed: boolean
      }
    | undefined
  deferredPrompt: BeforeInstallPromptEvent | null
}

export interface UISettingsActions {
  setShaderEnabled: (enabled: boolean) => void
  toggleShaderEnabled: () => void
  setTheme: (theme: 'zinc' | 'slate') => void
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void
  setPwaDismissed: (dismissed: boolean) => void
  setSuppressAutoRestore: (suppress: boolean) => void
}

export type UISettingsStore = UISettingsState & UISettingsActions

export const useSettingsStore = create<UISettingsStore>()(
  persist(
    (set, get) => ({
      shaderEnabled: true,
      theme: 'zinc',
      suppressAutoRestore: false,
      pwaInstall: undefined,
      deferredPrompt: null,
      setShaderEnabled: (enabled: boolean) => set({ shaderEnabled: enabled }),
      toggleShaderEnabled: () => set({ shaderEnabled: !get().shaderEnabled }),
      setTheme: (theme: 'zinc' | 'slate') => set({ theme }),
      setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => set({ deferredPrompt: e }),
      setPwaDismissed: (dismissed: boolean) => set({ pwaInstall: { dismissed } }),
      setSuppressAutoRestore: (suppress: boolean) => set({ suppressAutoRestore: suppress }),
    }),
    {
      name: 'ui-settings',
      version: 3,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
