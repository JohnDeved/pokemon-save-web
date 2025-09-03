import { Suspense, useRef } from 'react'
import { Card } from './components/common'
import { PWAInstallPrompt, triggerPWAInstall } from './components/common/PWAInstallPrompt'
import { ShaderBackground } from './components/common/ShaderBackground'
import { CompactPokemonSelector, PokemonHeader, PokemonMovesSection, PokemonPartyList, PokemonStatDisplay, PokemonTraitsSection, SaveFileDropzone } from './components/pokemon'
import { Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from './components/ui/menubar'
import { Toaster } from './components/ui/sonner'
import { usePokemonData } from './hooks'
import { useSettingsStore } from './stores'
import type { GlobalThisWithFileSystemAPI } from './types/global'

export const App: React.FC = () => {
  const { partyList, activePokemon, isLoading, saveFileParser, preloadPokemonDetails } = usePokemonData()

  // UI preferences from persisted store
  const shaderEnabled = useSettingsStore(s => s.shaderEnabled)
  const setShaderEnabled = useSettingsStore(s => s.setShaderEnabled)

  // Check if the browser supports the File System Access API
  const canSaveAs = typeof globalThis !== 'undefined' && !!(globalThis as unknown as GlobalThisWithFileSystemAPI).showSaveFilePicker
  // Determine if there is save data to display
  const hasSaveData = saveFileParser.hasFile && partyList.length > 0
  // Only show dropzone if there is no save data and last parse did not fail
  const shouldShowDropzone = !hasSaveData && !saveFileParser.lastParseFailed
  // Store the file picker function from SaveFileDropzone using a ref to avoid update loops
  const filePickerRef = useRef<() => void>(null)
  const hasInstallAvailable = useSettingsStore(s => !!s.deferredPrompt)

  return (
    <>
      {/* Background pattern appears immediately */}
      <div className="fixed inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]" />
      {/* Shader overlay fades in after pattern */}
      {shaderEnabled && (
        <Suspense fallback={null}>
          <ShaderBackground />
        </Suspense>
      )}
      <Toaster richColors position="bottom-center" />
      <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
        <SaveFileDropzone
          onFileLoad={saveFileParser.parse}
          error={saveFileParser.error}
          showDropzone={shouldShowDropzone}
          onOpenFilePicker={fn => {
            filePickerRef.current = fn
          }}
        />
        {hasSaveData && (
          <main className="max-w-6xl mx-auto z-10 gap-4 flex flex-col">
            <CompactPokemonSelector />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 z-10">
              <div className="flex flex-col gap-4">
                <Menubar className="geist-font">
                  <MenubarMenu>
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem
                        onClick={() => {
                          filePickerRef.current?.()
                        }}
                      >
                        Open
                      </MenubarItem>
                      <MenubarItem disabled>Open Recent</MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem disabled={!saveFileParser.parser?.fileHandle} onClick={() => saveFileParser.reconstructAndDownload('save')}>
                        Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={() => saveFileParser.reconstructAndDownload('saveAs')} disabled={!canSaveAs}>
                        Save As
                      </MenubarItem>
                      <MenubarItem onClick={() => saveFileParser.reconstructAndDownload()}>Download</MenubarItem>
                      <MenubarSeparator />
                      <MenubarSub>
                        <MenubarSubTrigger>Party</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem disabled>Load from File</MenubarItem>
                          <MenubarItem disabled>Storage</MenubarItem>
                          <MenubarSeparator />
                          <MenubarItem disabled>Save As</MenubarItem>
                          <MenubarItem disabled>Download</MenubarItem>
                          <MenubarItem disabled>Store</MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      <MenubarSeparator />
                      <MenubarSub>
                        <MenubarSubTrigger>Player</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem disabled>
                            Info <MenubarShortcut>{saveFileParser.saveData?.player_name}</MenubarShortcut>
                          </MenubarItem>
                          <MenubarItem disabled>Rename</MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      <MenubarSeparator />
                      <MenubarItem disabled>Share</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Edit</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem disabled>
                        Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem disabled>
                        Redo <MenubarShortcut>Ctrl+Shift+Y</MenubarShortcut>
                      </MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem disabled>Reset</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Help</MenubarTrigger>
                    <MenubarContent>
                      <MenubarCheckboxItem checked={shaderEnabled} onCheckedChange={v => setShaderEnabled(Boolean(v))}>
                        Shader Background
                      </MenubarCheckboxItem>
                      <MenubarSeparator />
                      <MenubarItem
                        onClick={() => {
                          location.reload()
                        }}
                      >
                        Restart
                      </MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem disabled>Github</MenubarItem>
                      <MenubarItem disabled>About</MenubarItem>
                      <MenubarItem disabled={!hasInstallAvailable} onClick={() => void triggerPWAInstall()}>
                        Install App
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
                <div className="hidden lg:block">
                  <PokemonPartyList isRenaming={false} onPokemonHover={preloadPokemonDetails} />
                </div>
              </div>
              <div className="grid grid-rows-[auto_auto_1fr] gap-4">
                <Card className="z-30">
                  <PokemonHeader isLoading={isLoading} />
                  <PokemonMovesSection isLoading={!activePokemon?.details || isLoading} />
                </Card>
                <Card className="z-20">
                  <PokemonStatDisplay isLoading={!activePokemon?.details || isLoading} />
                </Card>
                <Card className="z-10">
                  <PokemonTraitsSection isLoading={!activePokemon?.details || isLoading} />
                </Card>
              </div>
            </div>
          </main>
        )}
      </div>
      <PWAInstallPrompt />
    </>
  )
}
