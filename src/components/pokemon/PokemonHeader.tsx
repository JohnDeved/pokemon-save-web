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
    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="p-4 border-b border-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="h-8 flex items-center">
                            <Skeleton.Text as="h2" className="text-xl text-white tracking-tight flex items-center gap-2">
                                {pokemon?.data.nickname}
                            </Skeleton.Text>
                        </div>
                        <Skeleton.Container className="flex items-center gap-2 mt-2">
                            {isLoading
                                ? <><PokemonTypeBadge type="UNKNOWN" isLarge={true} /><PokemonTypeBadge type="UNKNOWN" isLarge={true} /></>
                                : pokemonDetails?.types.map(type => <PokemonTypeBadge key={type} type={type} isLarge={true} />)
                            }
                        </Skeleton.Container>
                    </div>
                    <Skeleton.Container className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
                        <Hash size={12} />
                        <span>
                            {String(pokemon?.data.speciesId).padStart(3, '0')}
                        </span>
                    </Skeleton.Container>
                </div>
            </div>
        </Skeleton.LoadingProvider>
    );
};
