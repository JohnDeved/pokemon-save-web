import { Suspense, lazy, useRef } from 'react'
import { Card } from './components/common'
import {
  PokemonAbilitySection,
  PokemonHeader,
  PokemonMovesSection,
  PokemonPartyList,
  PokemonStatDisplay,
  SaveFileDropzone,
} from './components/pokemon'
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from './components/ui/menubar'
import { Toaster } from './components/ui/sonner'
import { usePokemonData } from './hooks'

// Dynamically import ShaderBackground to code-split heavy 3D dependencies
const ShaderBackground = lazy(() =>
  import('./components/common/ShaderBackground').then(module => ({
    default: module.ShaderBackground,
  })),
)

export const App: React.FC = () => {
  const {
    partyList,
    activePokemonId,
    setActivePokemonId,
    activePokemon,
    isLoading,
    saveFileParser,
    setEvIndex,
    setIvIndex,
    preloadPokemonDetails,
    getRemainingEvs,
    setNature,
  } = usePokemonData()

  // Check if the browser supports the File System Access API
  const canSaveAs = typeof window !== 'undefined' && !!window.showSaveFilePicker
  // Determine if there is save data to display
  const hasSaveData = saveFileParser.hasFile && partyList.length > 0
  // Only show dropzone if there is no save data and last parse did not fail
  const shouldShowDropzone = !hasSaveData && !saveFileParser.lastParseFailed
  // Store the file picker function from SaveFileDropzone using a ref to avoid update loops
  const filePickerRef = useRef<() => void>(null)

  return (
    <>
      <Suspense fallback={<div className="fixed inset-0 bg-black"/>}>
        <ShaderBackground/>
      </Suspense>
      <Toaster richColors position="bottom-center"/>
      <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
        <div className="absolute inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]"/>
        <SaveFileDropzone
          onFileLoad={saveFileParser.parseSaveFile}
          error={saveFileParser.error}
          showDropzone={shouldShowDropzone}
          onOpenFilePicker={fn => { filePickerRef.current = fn }}
        />
        {hasSaveData && (
          <main className="max-w-6xl mx-auto z-10 gap-4 flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 z-10">
              <div className="flex flex-col gap-4">
                <Menubar className="geist-font">
                  <MenubarMenu>
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem onClick={() => { filePickerRef.current?.() }}>
                        Open
                      </MenubarItem>
                      <MenubarItem disabled>Open Recent</MenubarItem>
                      <MenubarSeparator/>
                      <MenubarItem
                        disabled={!saveFileParser.parser?.fileHandle}
                        onClick={() => saveFileParser.reconstructAndDownload('save')}
                      >Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
                      </MenubarItem>
                      <MenubarItem
                        onClick={() => saveFileParser.reconstructAndDownload('saveAs')}
                        disabled={!canSaveAs}
                      >Save As
                      </MenubarItem>
                      <MenubarItem
                        onClick={() => saveFileParser.reconstructAndDownload()}
                      >Download
                      </MenubarItem>
                      <MenubarSeparator/>
                      <MenubarSub>
                        <MenubarSubTrigger>Party</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem disabled>Load from File</MenubarItem>
                          <MenubarItem disabled>Storage</MenubarItem>
                          <MenubarSeparator/>
                          <MenubarItem disabled>Save As</MenubarItem>
                          <MenubarItem disabled>Download</MenubarItem>
                          <MenubarItem disabled>Store</MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      <MenubarSeparator/>
                      <MenubarSub>
                        <MenubarSubTrigger>Player</MenubarSubTrigger>
                        <MenubarSubContent>
                          <MenubarItem disabled>Info <MenubarShortcut>{saveFileParser.saveData?.player_name}</MenubarShortcut></MenubarItem>
                          <MenubarItem disabled>Rename</MenubarItem>
                        </MenubarSubContent>
                      </MenubarSub>
                      <MenubarSeparator/>
                      <MenubarItem disabled>Share</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Edit</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem disabled>Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem>
                      <MenubarItem disabled>Redo <MenubarShortcut>Ctrl+Shift+Y</MenubarShortcut></MenubarItem>
                      <MenubarSeparator/>
                      <MenubarItem disabled>Reset</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>Help</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem onClick={() => { location.reload() }}>Restart</MenubarItem>
                      <MenubarSeparator/>
                      <MenubarItem disabled>Github</MenubarItem>
                      <MenubarItem disabled>About</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
                <PokemonPartyList
                  partyList={partyList}
                  activePokemonId={activePokemonId}
                  onPokemonSelect={setActivePokemonId}
                  isRenaming={false}
                  onPokemonHover={preloadPokemonDetails}
                />
              </div>
              <div className="grid grid-rows-[auto_auto_1fr] gap-4">
                <Card className="z-30">
                  <PokemonHeader
                    pokemon={activePokemon}
                    setNature={setNature}
                    isLoading={isLoading}
                  />
                  <PokemonMovesSection
                    moves={activePokemon?.details?.moves}
                    isLoading={!activePokemon?.details || isLoading}
                  />
                </Card>
                <Card className="z-20">
                  <PokemonStatDisplay
                    setEvIndex={setEvIndex}
                    setIvIndex={setIvIndex}
                    pokemon={activePokemon}
                    isLoading={!activePokemon?.details || isLoading}
                    getRemainingEvs={getRemainingEvs}
                  />
                </Card>
                <Card className="z-10">
                  <PokemonAbilitySection
                    pokemon={activePokemon}
                    isLoading={!activePokemon?.details || isLoading}
                  />
                </Card>
              </div>
            </div>
          </main>
        )}
      </div>
    </>
  )
}
