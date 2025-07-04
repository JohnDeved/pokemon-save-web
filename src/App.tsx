import { Suspense, lazy } from 'react';
import { Card } from './components/common';
import {
    PokemonAbilitySection,
    PokemonHeader,
    PokemonMovesSection,
    PokemonPartyList,
    PokemonStatDisplay,
    SaveFileDropzone
} from './components/pokemon';
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
        preloadPokemonDetails // Add preloading function
    } = usePokemonData();
    
    const hasSaveData = saveFileParser.hasFile && partyList.length > 0;

    return (
        <>
            <Suspense fallback={<div className="fixed inset-0 z-10 bg-black" />}>
                <ShaderBackground />
            </Suspense>
            <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
                <div className="absolute inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]"></div>
                
                <SaveFileDropzone
                    onFileLoad={saveFileParser.parseSaveFile}
                    error={saveFileParser.error}
                    showDropzone={!hasSaveData}
                />

                {hasSaveData && (
                    <main className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 z-10">
                        <PokemonPartyList
                            partyList={partyList}
                            activePokemonId={activePokemonId}
                            onPokemonSelect={setActivePokemonId}
                            isRenaming={false}
                            onPokemonHover={preloadPokemonDetails} // Preload on hover
                        />
                        <div className="grid grid-rows-[auto_auto_1fr] gap-4">
                            <Card className="z-30">
                                <PokemonHeader
                                    pokemon={activePokemon}
                                    isLoading={isLoading}
                                />
                                <PokemonMovesSection
                                    moves={activePokemon?.details?.moves}
                                    isLoading={!activePokemon?.details || isLoading}
                                />
                            </Card>
                            <Card className="z-20">
                                <PokemonStatDisplay 
                                    pokemon={activePokemon}
                                    isLoading={!activePokemon?.details || isLoading}
                                />
                            </Card>                            
                            <Card className="z-10">
                                <PokemonAbilitySection
                                    pokemon={activePokemon}
                                    isLoading={!activePokemon?.details || isLoading}
                                />
                            </Card>
                        </div>
                    </main>
                )}
            </div>
        </>
    );
}
