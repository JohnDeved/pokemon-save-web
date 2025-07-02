import React from 'react';
import { Hash } from 'lucide-react';
import { PokemonTypeBadge } from './PokemonTypeBadge';
import { Skeleton } from '../common';
import type { Pokemon, DetailedCache } from '../../types';

interface PokemonHeaderProps {
    pokemon?: Pokemon;
    pokemonDetails?: DetailedCache[number];
    isLoading?: boolean;
}

export const PokemonHeader: React.FC<PokemonHeaderProps> = ({
    pokemon,
    pokemonDetails,
    isLoading = false
}) => {
    if (isLoading || !pokemon || !pokemonDetails) {
        return (
            <div className="p-4 border-b border-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="h-8 flex items-center">
                            <Skeleton.Text as="h2" className="text-xl text-white tracking-tight flex items-center gap-2">
                                Pokemon Name
                                <Skeleton.Box className="w-3 h-3" />
                            </Skeleton.Text>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            {/* Mimic exact PokemonTypeBadge structure */}
                            <Skeleton.Container className="inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br px-3 py-1 text-[10px] shadow-md">
                                <Skeleton.Image className="w-3 h-3" />
                                <Skeleton.Text>FIRE</Skeleton.Text>
                            </Skeleton.Container>
                            <Skeleton.Container className="inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br px-3 py-1 text-[10px] shadow-md">
                                <Skeleton.Image className="w-3 h-3" />
                                <Skeleton.Text>FLYING</Skeleton.Text>
                            </Skeleton.Container>
                        </div>
                    </div>
                    {/* Mimic exact ID badge structure */}
                    <Skeleton.Container className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
                        <Skeleton.Box className="w-3 h-3" />
                        <Skeleton.Text>006</Skeleton.Text>
                    </Skeleton.Container>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 border-b border-slate-800">
            <div className="flex justify-between items-start">
                <div>
                    <div className="h-8 flex items-center">
                        <h2 className="text-xl text-white tracking-tight flex items-center gap-2">
                            {pokemon.data.nickname}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        {pokemonDetails.types.map(type => 
                            <PokemonTypeBadge key={type} type={type} isLarge={true} />
                        )}
                    </div>
                </div>
                <span className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
                    <Hash size={12} />
                    {String(pokemon.data.speciesId).padStart(3, '0')}
                </span>
            </div>
        </div>
    );
};
