import { ExternalLinkIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { triggerPWAInstall } from '@/components/common/PWAInstallPrompt'
import { useRecentFiles } from '@/hooks/useRecentFiles'
import { useSaveFileStore, useSettingsStore } from '@/stores'
import {
  canRedoSelector,
  canUndoSelector,
  hasEditsSelector,
  useHistoryStore,
} from '@/stores/useHistoryStore'
import { hasFsPermissions } from '@/types/fs'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AppMenubarProps {
  onRequestOpenFile: () => void
  canSaveAs: boolean
  commitHash: string
}

export const AppMenubar: React.FC<AppMenubarProps> = ({
  onRequestOpenFile,
  canSaveAs,
  commitHash,
}) => {
  const [aboutOpen, setAboutOpen] = useState(false)
  const shaderEnabled = useSettingsStore(s => s.shaderEnabled)
  const setShaderEnabled = useSettingsStore(s => s.setShaderEnabled)
  const theme = useSettingsStore(s => s.theme)
  const setTheme = useSettingsStore(s => s.setTheme)
  const setSuppressAutoRestore = useSettingsStore(s => s.setSuppressAutoRestore)
  const hasInstallAvailable = useSettingsStore(s => !!s.deferredPrompt)

  const clearSaveFile = useSaveFileStore(s => s.clearSaveFile)
  const reconstructAndDownload = useSaveFileStore(s => s.reconstructAndDownload)
  const parse = useSaveFileStore(s => s.parse)
  const parser = useSaveFileStore(s => s.parser)
  const hasFile = useSaveFileStore(s => s.hasFile)
  const playerName = useSaveFileStore(s => s.saveData?.player_name)

  const canUndo = useHistoryStore(canUndoSelector)
  const canRedo = useHistoryStore(canRedoSelector)
  const hasEdits = useHistoryStore(hasEditsSelector)
  const undo = useHistoryStore(s => s.undo)
  const redo = useHistoryStore(s => s.redo)
  const reset = useHistoryStore(s => s.reset)

  const { recents, clear: clearRecents } = useRecentFiles()

  const openRecent = useCallback(
    async (handle: FileSystemFileHandle) => {
      try {
        if (hasFsPermissions(handle) && typeof handle.queryPermission === 'function') {
          const status = await handle.queryPermission({ mode: 'read' })
          if (status !== 'granted' && typeof handle.requestPermission === 'function') {
            const res = await handle.requestPermission({ mode: 'read' })
            if (res !== 'granted') {
              toast.error('Permission to read this file was denied.', {
                position: 'bottom-center',
                duration: 3500,
              })
              return
            }
          }
        }
        await parse(handle)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load save file'
        toast.error(message, { position: 'bottom-center', duration: 4500 })
      }
    },
    [parse]
  )

  return (
    <>
      <Menubar className="geist-font">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onRequestOpenFile}>Open</MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>Open Recent</MenubarSubTrigger>
              <MenubarSubContent>
                {recents.length === 0 && <MenubarItem disabled>No recent files</MenubarItem>}
                {recents.map(recent => (
                  <MenubarItem key={recent.id} onSelect={() => void openRecent(recent.handle)}>
                    {recent.name}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
                <MenubarItem disabled={recents.length === 0} onClick={() => void clearRecents()}>
                  Clear Recents
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarItem
              onClick={() => {
                setSuppressAutoRestore(true)
                clearSaveFile()
              }}
            >
              Unload
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              disabled={!parser?.fileHandle}
              onClick={() => reconstructAndDownload('save')}
            >
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
          <MenubarTrigger>Theme</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem
              checked={shaderEnabled}
              onCheckedChange={value => setShaderEnabled(Boolean(value))}
            >
              Animated Background
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarRadioGroup
              value={theme}
              onValueChange={value => setTheme(value as typeof theme)}
            >
              <MenubarRadioItem value="zinc">Zinc</MenubarRadioItem>
              <MenubarRadioItem value="slate">Slate</MenubarRadioItem>
              <MenubarRadioItem value="light">Light</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => location.reload()}>Restart</MenubarItem>
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
              <span className="text-muted-foreground">Version:</span> {commitHash}
            </div>
            <div>
              <span className="text-muted-foreground">Credits (Discord):</span>{' '}
              can_not_read_properties_of
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
