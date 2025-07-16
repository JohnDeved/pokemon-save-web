import { Suspense, lazy, useState } from 'react';
import {
    PokemonAbilitySection,
    PokemonHeader,
    PokemonMovesSection,
    PokemonPartyList,
    PokemonStatDisplay,
    SaveFileDropzone
} from './components/pokemon';
import { Card } from './components/common';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from './components/ui/menubar';
import { usePokemonData } from './hooks';

// Dynamically import ShaderBackground to code-split heavy 3D dependencies
const ShaderBackground = lazy(() =>
    import('./components/common/ShaderBackground').then(module => ({
        default: module.ShaderBackground
    }))
);

export default function App() {
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
        setNature
    } = usePokemonData();

    const hasSaveData = saveFileParser.hasFile && partyList.length > 0;
    // Store the openFileWithPicker function from SaveFileDropzone
    const [openFilePicker, setOpenFilePicker] = useState<() => void>(() => {});

    return (
        <>
            <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
                <ShaderBackground />
            </Suspense>
            <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
                <div className="absolute inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]"></div>

                <SaveFileDropzone
                    onFileLoad={saveFileParser.parseSaveFile}
                    error={saveFileParser.error}
                    showDropzone={!hasSaveData}
                    onOpenFilePicker={fn => setOpenFilePicker(() => fn)}
                />

                {hasSaveData && (
                    <main className="max-w-6xl mx-auto z-10 gap-4 flex flex-col">
                        <div className="flex justify-start">
                            <Menubar>
                                <MenubarMenu>
                                    <MenubarTrigger>File</MenubarTrigger>
                                    <MenubarContent>
                                        <MenubarItem onClick={() => openFilePicker?.()}>
                                            Load
                                        </MenubarItem>
                                        <MenubarItem disabled>Save</MenubarItem>
                                        <MenubarItem onClick={() => {
                                            const pokemon = saveFileParser.saveData?.party_pokemon
                                            if (!pokemon) return;
                                            saveFileParser.reconstructAndDownload(pokemon)
                                        }}>Download</MenubarItem>
                                        <MenubarSeparator />
                                        <MenubarItem disabled>Share</MenubarItem>
                                    </MenubarContent>
                                </MenubarMenu>
                            </Menubar>
                        </div>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 z-10'>
                            <PokemonPartyList
                                partyList={partyList}
                                activePokemonId={activePokemonId}
                                onPokemonSelect={setActivePokemonId}
                                isRenaming={false}
                                onPokemonHover={preloadPokemonDetails}
                            />
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
    );
}
