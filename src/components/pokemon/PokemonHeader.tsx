import { IoSparkles } from "react-icons/io5";
import { FaHashtag } from "react-icons/fa6";
import { FaWandMagicSparkles } from "react-icons/fa6";
import React from 'react';
import type { Pokemon, PokemonDetails } from '../../types';
import { Skeleton } from '../common';
import { PokemonTypeBadge } from './PokemonTypeBadge';

interface PokemonHeaderProps {
    pokemon?: Pokemon;
    pokemonDetails?: PokemonDetails;
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
                {/* Row 1: Name and Dex ID */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl text-white tracking-tight flex items-center gap-2 h-8">
                        {pokemon?.data.nickname}
                    </h2>
                    <div className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
                        <FaHashtag size={12} />
                        <span>
                            {String(pokemon?.data.speciesId).padStart(3, '0')}
                        </span>
                    </div>
                </div>
                {/* Row 2: Typing and Nature */}
                <div className="flex items-center justify-between mt-2 min-h-[25px]">
                    <div className="flex items-center gap-2 min-w-8">
                        {pokemonDetails?.types.map(type => <PokemonTypeBadge key={type} type={type} isLarge={true} />)}
                    </div>
                    <div className="flex items-center gap-2 min-w-8">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                            {pokemon?.data.nature}
                        </span>
                        {pokemon?.data.isShiny && (
                            <span title="Shiny">
                                <IoSparkles className='text-yellow-300/80'/>
                            </span>
                        )}
                        {pokemon?.data.isRadiant && (
                            <span title="Radiant">
                                <FaWandMagicSparkles className='text-purple-400/80'/>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Skeleton.LoadingProvider>
    );
};
