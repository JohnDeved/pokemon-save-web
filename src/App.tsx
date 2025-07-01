import { useState } from 'react';
import { ShaderBackground, Card } from './components/common';
import {
    PokemonPartyList,
    PokemonHeader,
    PokemonMovesSection,
    PokemonStatDisplay,
    PokemonAbilitySection,
    PokemonDetailsSkeleton
} from './components/pokemon';
import { usePokemonData, usePokemonRenaming } from './hooks';

// --- Main App Component ---
export default function App() {
    const {
        partyList,
        activePokemonId,
        setActivePokemonId,
        activePokemon,
        detailedCache,
        isLoading,
        updatePokemonNickname
    } = usePokemonData();

    const [expandedMoveName, setExpandedMoveName] = useState<string | null>(null);

    const {
        isRenaming,
        renameInput,
        setRenameInput,
        handleStartEditing,
        handleConfirmRename,
        handleCancelRename,
        handleKeyDown
    } = usePokemonRenaming(
        activePokemon?.nickname || '',
        (newName) => {
            if (activePokemon) {
                updatePokemonNickname(activePokemon.id, newName);
            }
        }
    );

    const activePokemonDetails = activePokemon ? detailedCache[activePokemon.speciesId] : null;
    
    return (
        <>
          <ShaderBackground />
            <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
                <div className="absolute inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]"></div>
                <main className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 z-10">
                    <PokemonPartyList
                        partyList={partyList}
                        activePokemonId={activePokemonId}
                        onPokemonSelect={setActivePokemonId}
                        isRenaming={isRenaming}
                    />
                    <div className="grid grid-rows-[auto_auto_1fr] gap-4 min-h-0">
                        {(!activePokemon || !activePokemonDetails || isLoading) ? <PokemonDetailsSkeleton /> : (
                             <>
                                <Card className={`z-30 relative`}>
                                    <PokemonHeader
                                        pokemon={activePokemon}
                                        pokemonDetails={activePokemonDetails}
                                        isRenaming={isRenaming}
                                        renameInput={renameInput}
                                        onStartRename={handleStartEditing}
                                        onConfirmRename={handleConfirmRename}
                                        onCancelRename={handleCancelRename}
                                        onRenameInputChange={setRenameInput}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <PokemonMovesSection
                                        moves={activePokemonDetails.moves}
                                        expandedMoveName={expandedMoveName}
                                        onMoveHover={setExpandedMoveName}
                                    />
                                </Card>
                                <Card className={`p-4 ${expandedMoveName ? 'z-20' : 'z-20'} relative`}>
                                    <PokemonStatDisplay ivs={activePokemon.ivs} evs={activePokemon.evs} baseStats={activePokemon.baseStats} />
                                </Card>
                                <PokemonAbilitySection ability={activePokemonDetails.ability} />
                             </>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
