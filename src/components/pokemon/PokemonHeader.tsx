import type { usePokemonData } from "@/hooks";
import { getItemSpriteUrl, natures } from "@/lib/parser/utils";
import React from 'react';
import { FaHashtag, FaWandMagicSparkles } from "react-icons/fa6";
import { IoSparkles } from "react-icons/io5";
import type { Pokemon } from '../../types';
import { Skeleton } from '../common';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { PokemonTypeBadge } from './PokemonTypeBadge';

interface PokemonHeaderProps {
    pokemon?: Pokemon;
    isLoading?: boolean;
    setNature?: ReturnType<typeof usePokemonData>['setNature'];
}

export const PokemonHeader: React.FC<PokemonHeaderProps> = ({
    pokemon,
    setNature,
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
                        <Select value={pokemon?.data.nature ?? undefined} onValueChange={nature => {
                            console.log('Setting nature:', pokemon?.id, nature);
                            if (typeof pokemon?.id === 'undefined') return;
                            setNature?.(pokemon.id, nature)
                        }}>
                            <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Nature" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {natures.map(nature => (
                                        <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </Skeleton.LoadingProvider>
    );
};
