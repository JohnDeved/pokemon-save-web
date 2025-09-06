import { Suspense, useRef, useState } from 'react'
import { ExternalLinkIcon } from 'lucide-react'
import { Card } from './components/common'
import { PWAInstallPrompt, triggerPWAInstall } from './components/common/PWAInstallPrompt'
import { ShaderBackground } from './components/common/ShaderBackground'
import { CompactPokemonSelector, PokemonHeader, PokemonMovesSection, PokemonPartyList, PokemonStatDisplay, PokemonTraitsSection, SaveFileDropzone } from './components/pokemon'
import { Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from './components/ui/menubar'
import { Toaster } from './components/ui/sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog'
import { usePokemonData } from './hooks'
import { useSaveFileStore } from './stores'
import { useSettingsStore } from './stores'
import type { GlobalThisWithFileSystemAPI } from './types/global'

export const App: React.FC = () => {
  const { partyList, preloadPokemonDetails } = usePokemonData()
  // Safe commit hash for runtime, even if Vite define not loaded yet
  const COMMIT_HASH = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'dev'

  // UI preferences from persisted store
  const shaderEnabled = useSettingsStore(s => s.shaderEnabled)
  const setShaderEnabled = useSettingsStore(s => s.setShaderEnabled)

  // Check if the browser supports the File System Access API
  const canSaveAs = typeof globalThis !== 'undefined' && !!(globalThis as unknown as GlobalThisWithFileSystemAPI).showSaveFilePicker
  // Save file store selectors
  const parse = useSaveFileStore(s => s.parse)
  const error = useSaveFileStore(s => s.error)
  const hasFile = useSaveFileStore(s => s.hasFile)
  const lastParseFailed = useSaveFileStore(s => s.lastParseFailed)
  const reconstructAndDownload = useSaveFileStore(s => s.reconstructAndDownload)
  const parser = useSaveFileStore(s => s.parser)
  const playerName = useSaveFileStore(s => s.saveData?.player_name)
  // Determine if there is save data to display
  const hasSaveData = hasFile && partyList.length > 0
  // Only show dropzone if there is no save data and last parse did not fail
  const shouldShowDropzone = !hasSaveData && !lastParseFailed
  // Store the file picker function from SaveFileDropzone using a ref to avoid update loops
  const filePickerRef = useRef<() => void>(null)
  const hasInstallAvailable = useSettingsStore(s => !!s.deferredPrompt)
  const [aboutOpen, setAboutOpen] = useState(false)

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
          onFileLoad={parse}
          error={error}
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
                      <MenubarItem disabled={!parser?.fileHandle} onClick={() => reconstructAndDownload('save')}>
                        Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem onClick={() => reconstructAndDownload('saveAs')} disabled={!canSaveAs}>
                        Save As
                      </MenubarItem>
                      <MenubarItem onClick={() => reconstructAndDownload()}>Download</MenubarItem>
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
                            Info <MenubarShortcut>{playerName}</MenubarShortcut>
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
                      <MenubarItem asChild>
                        <a
                          href="https://github.com/JohnDeved/pokemon-save-web"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          GitHub <ExternalLinkIcon className="ml-1" />
                        </a>
                      </MenubarItem>
                      <MenubarItem onSelect={() => setAboutOpen(true)}>About</MenubarItem>
                      <MenubarItem disabled={!hasInstallAvailable} onClick={() => void triggerPWAInstall()}>
                        Install App
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
                <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
                  <DialogContent className="geist-font">
                    <DialogHeader>
                      <DialogTitle>Pokemon Save Editor</DialogTitle>
                      <DialogDescription>
                        A web-based save editor for Pokemon games and ROM hacks.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm leading-relaxed space-y-3">
                      <div>
                        <span className="text-muted-foreground">Repository:</span>{' '}
                        <a
                          href="https://github.com/JohnDeved/pokemon-save-web"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4 hover:no-underline"
                        >
                          github.com/JohnDeved/pokemon-save-web
                        </a>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Version:</span> {COMMIT_HASH}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credits (Discord):</span>{' '}
                        can_not_read_properties_of
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="hidden lg:block">
                  <PokemonPartyList isRenaming={false} onPokemonHover={preloadPokemonDetails} />
                </div>
              </div>
              <div className="grid grid-rows-[auto_auto_1fr] gap-4">
                <Card className="z-30">
                  <PokemonHeader />
                  <PokemonMovesSection />
                </Card>
                <Card className="z-20">
                  <PokemonStatDisplay />
                </Card>
                <Card className="z-10">
                  <PokemonTraitsSection />
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
