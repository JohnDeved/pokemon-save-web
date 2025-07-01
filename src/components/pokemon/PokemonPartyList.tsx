import React from 'react';
import { PokemonStatus } from './PokemonStatus';
import type { Pokemon } from '../../types';

interface PokemonPartyListProps {
    partyList: Pokemon[];
    activePokemonId: number;
    onPokemonSelect: (id: number) => void;
    isRenaming: boolean;
}

export const PokemonPartyList: React.FC<PokemonPartyListProps> = ({
    partyList,
    activePokemonId,
    onPokemonSelect,
    isRenaming
}) => {
    return (
        <section className="flex flex-col gap-4">
            {partyList.map(pokemon => (
                <div 
                    key={pokemon.id} 
                    onClick={() => { if (!isRenaming) onPokemonSelect(pokemon.id); }} 
                    className="cursor-pointer group"
                >
                   <PokemonStatus pokemon={pokemon} isActive={pokemon.id === activePokemonId} />
                </div>
            ))}
        </section>
    );
};
