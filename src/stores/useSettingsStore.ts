import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface UISettingsState {
  shaderEnabled: boolean
}

export interface UISettingsActions {
  setShaderEnabled: (enabled: boolean) => void
  toggleShaderEnabled: () => void
}

export type UISettingsStore = UISettingsState & UISettingsActions

export const useSettingsStore = create<UISettingsStore>()(
  persist(
    (set, get) => ({
      shaderEnabled: true,
      setShaderEnabled: (enabled: boolean) => set({ shaderEnabled: enabled }),
      toggleShaderEnabled: () => set({ shaderEnabled: !get().shaderEnabled }),
    }),
    {
      name: 'ui-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
