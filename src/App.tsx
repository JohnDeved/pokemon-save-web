import { ExternalLinkIcon } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { listRecents } from '@/lib/recentFiles'
import { Card } from './components/common'
import { PWAInstallPrompt, triggerPWAInstall } from './components/common/PWAInstallPrompt'
import { ShaderBackground } from './components/common/ShaderBackground'
import { CompactPokemonSelector, PokemonHeader, PokemonMovesSection, PokemonPartyList, PokemonStatDisplay, PokemonTraitsSection, SaveFileDropzone } from './components/pokemon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from './components/ui/menubar'
import { Toaster } from './components/ui/sonner'
import { usePokemonData } from './hooks'
import { useRecentFiles } from './hooks/useRecentFiles'
import { useSaveFileStore, useSettingsStore } from './stores'
import { canRedoSelector, canUndoSelector, hasEditsSelector, useHistoryStore } from './stores/useHistoryStore'
import { hasFsPermissions } from './types/fs'

export const App: React.FC = () => {
  const { partyList, preloadPokemonDetails } = usePokemonData()
  // Safe commit hash for runtime, even if Vite define not loaded yet
  const COMMIT_HASH = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'dev'
  const DEFAULT_TITLE = 'Pokemon Save Editor - Edit Pokemon Save Files Online'

  // UI preferences from persisted store
  const shaderEnabled = useSettingsStore(s => s.shaderEnabled)
  const setShaderEnabled = useSettingsStore(s => s.setShaderEnabled)

  // Check if the browser supports the File System Access API
  const canSaveAs = typeof showSaveFilePicker === 'function'
  // Save file store selectors
  const parse = useSaveFileStore(s => s.parse)
  const error = useSaveFileStore(s => s.error)
  const hasFile = useSaveFileStore(s => s.hasFile)
  const lastParseFailed = useSaveFileStore(s => s.lastParseFailed)
  const reconstructAndDownload = useSaveFileStore(s => s.reconstructAndDownload)
  const parser = useSaveFileStore(s => s.parser)
  const saveFileName = useSaveFileStore(s => s.parser?.saveFileName)
  const playerName = useSaveFileStore(s => s.saveData?.player_name)
  // Determine if there is save data to display
  const hasSaveData = hasFile && partyList.length > 0
  // Only show dropzone if there is no save data and last parse did not fail
  const shouldShowDropzone = !hasSaveData && !lastParseFailed
  // Store the file picker function from SaveFileDropzone using a ref to avoid update loops
  const filePickerRef = useRef<() => void>(null)
  const hasInstallAvailable = useSettingsStore(s => !!s.deferredPrompt)
  const [aboutOpen, setAboutOpen] = useState(false)
  const { recents, clear: clearRecents } = useRecentFiles()
  const triedRestore = useRef(false)
  // History store selectors and actions
  const canUndo = useHistoryStore(canUndoSelector)
  const canRedo = useHistoryStore(canRedoSelector)
  const hasEdits = useHistoryStore(hasEditsSelector)
  const undo = useHistoryStore(s => s.undo)
  const redo = useHistoryStore(s => s.redo)
  const reset = useHistoryStore(s => s.reset)

  const openRecent = async (handle: FileSystemFileHandle) => {
    try {
      if (hasFsPermissions(handle) && typeof handle.queryPermission === 'function') {
        const status = await handle.queryPermission({ mode: 'read' })
        if (status !== 'granted' && typeof handle.requestPermission === 'function') {
          const res = await handle.requestPermission({ mode: 'read' })
          if (res !== 'granted') {
            toast.error('Permission to read this file was denied.', { position: 'bottom-center', duration: 3500 })
            return
          }
        }
      }
      await parse(handle)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load save file'
      toast.error(message, { position: 'bottom-center', duration: 4500 })
    }
  }

  // Try to restore the most recent file on load
  useEffect(() => {
    if (triedRestore.current) return
    triedRestore.current = true
    ;(async () => {
      try {
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
      } catch (e) {
        // Silently ignore, user can still open via menu
        console.warn('Auto-restore last file failed:', e)
      }
    })()
  }, [parse])

  // Update document title with file name
  useEffect(() => {
    if (hasFile && saveFileName) {
      document.title = `${saveFileName} — Pokemon Save Editor`
    } else {
      document.title = DEFAULT_TITLE
    }
  }, [hasFile, saveFileName])

  // Global keyboard shortcuts for Undo/Redo
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

  // Initialize or clear history based on file load/clear events, but skip during undo/redo/reset
  useEffect(() => {
    const hist = useHistoryStore.getState()
    if (!hasFile) {
      hist.clear()
      return
    }
    if (!hist.isApplying) {
      hist.initFromCurrent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFile, parser, saveFileName])

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
                      <MenubarSub>
                        <MenubarSubTrigger>Open Recent</MenubarSubTrigger>
                        <MenubarSubContent>
                          {recents.length === 0 && <MenubarItem disabled>No recent files</MenubarItem>}
                          {recents.map(r => (
                            <MenubarItem
                              key={r.id}
                              onSelect={async () => {
                                await openRecent(r.handle)
                              }}
                            >
                              {r.name}
                            </MenubarItem>
                          ))}
                          <MenubarSeparator />
                          <MenubarItem disabled={recents.length === 0} onClick={() => void clearRecents()}>
                            Clear Recents
                          </MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
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
                      <MenubarItem disabled={!canUndo} onClick={() => void undo()}>
                        Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem disabled={!canRedo} onClick={() => void redo()}>
                        Redo <MenubarShortcut>Ctrl+Shift+Z</MenubarShortcut>
                      </MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem disabled={!hasFile || !hasEdits} onClick={() => void reset()}>
                        Reset
                      </MenubarItem>
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
                        <a href="https://github.com/JohnDeved/pokemon-save-web" target="_blank" rel="noopener noreferrer">
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
                      <DialogDescription>A web-based save editor for Pokemon games and ROM hacks.</DialogDescription>
                    </DialogHeader>
                    <div className="text-sm leading-relaxed space-y-3">
                      <div>
                        <span className="text-muted-foreground">Version:</span> {COMMIT_HASH}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credits (Discord):</span> can_not_read_properties_of
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
