import { IoSparkles } from "react-icons/io5";
import { FaHashtag } from "react-icons/fa6";
import { FaWandMagicSparkles } from "react-icons/fa6";
import React from 'react';
import type { Pokemon } from '../../types';
import { Skeleton } from '../common';
import { PokemonTypeBadge } from './PokemonTypeBadge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { getItemSpriteUrl } from "@/lib/parser/utils";

interface PokemonHeaderProps {
    pokemon?: Pokemon;
    isLoading?: boolean;
}

export const PokemonHeader: React.FC<PokemonHeaderProps> = ({
    pokemon,
    isLoading = false
}) => {
    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="p-4 border-b border-slate-800">
                {/* Row 1: Name and Dex ID */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl text-white tracking-tight flex items-center gap-2 h-8">
                        {pokemon?.data.nickname}
                        {pokemon?.data.isShiny && (
                            <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                    <span>
                                        <IoSparkles className='text-yellow-300/80' />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>Shiny</TooltipContent>
                            </Tooltip>
                        )}
                        {pokemon?.data.isRadiant && (
                            <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                    <span>
                                        <FaWandMagicSparkles className='text-purple-400/80' />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>Radiant</TooltipContent>
                            </Tooltip>
                        )}
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
                    <Skeleton.Container className="flex items-center gap-2 min-w-8">
                        {isLoading && (<PokemonTypeBadge type="UNKNOWN" isLarge={true} />)}
                        {pokemon?.details?.types.map(type => <PokemonTypeBadge key={type} type={type} isLarge={true} />)}
                    </Skeleton.Container>
                    <div className="flex items-center gap-2 min-w-8">
                        {
                            pokemon?.data.itemIdName && (
                                <img
                                    src={getItemSpriteUrl(pokemon.data.itemIdName)}
                                    alt={pokemon.data.itemIdName}
                                    className="w-6 h-6"
                                />
                            )
                        }
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                            {pokemon?.data.nature}
                        </span>
                    </div>
                </div>
            </div>
        </Skeleton.LoadingProvider>
    );
};
