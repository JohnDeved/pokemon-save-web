import React from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../common';
import type { Pokemon } from '../../types';

// Health percentage thresholds for color coding
const HP_THRESHOLDS = {
    HIGH: 50,
    LOW: 20
} as const;

// Props for PokemonStatus
export interface PokemonStatusProps {
    pokemon: Pokemon;
    isActive: boolean;
}

// Component for a single Pokémon's status display on the left
export const PokemonStatus: React.FC<PokemonStatusProps> = ({ pokemon, isActive }) => {
    const hpPercentage = (pokemon.data.currentHp / pokemon.data.maxHp) * 100;
    const hpColor = hpPercentage > HP_THRESHOLDS.HIGH 
        ? 'from-green-400 to-emerald-500' 
        : hpPercentage > HP_THRESHOLDS.LOW 
            ? 'from-yellow-400 to-amber-500' 
            : 'from-red-500 to-rose-600';

    const containerClasses = isActive 
        ? 'bg-slate-800/80 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30'
        : 'hover:bg-slate-800/80';

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.onerror = null;
        target.src = `https://placehold.co/96x96/334155/94a3b8?text=${String(pokemon.data.speciesId).padStart(3, '0')}`;
    };

    return (
        <Card className={cn("flex items-center p-3 transition-all duration-300", containerClasses)}>
            <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center relative">
                <img 
                    src={pokemon.spriteUrl}
                    className={cn("absolute z-0 w-full blur-md opacity-70 h-full object-contain transition-transform duration-300", 'scale-130')}
                    onError={handleImageError}
                />
                <img 
                    src={pokemon.spriteUrl} 
                    alt={pokemon.data.nickname} 
                    className={cn("z-10 w-full h-full object-contain transition-transform duration-300", isActive ? 'scale-110' : 'group-hover:scale-110')}
                    onError={handleImageError}
                />
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-center text-sm">
                    <h3 className="text-white">{pokemon.data.nickname}</h3>
                    <span className="text-slate-300">Lv.{pokemon.data.level}</span>
                </div>
                <div className="w-full bg-slate-900/30 border border-slate-700 border-x-2 rounded-sm h-2.5 mt-2 overflow-hidden">
                    <div className={cn("bg-gradient-to-r h-full transition-all duration-500", hpColor)} style={{ width: `${hpPercentage}%` }}></div>
                </div>
                <p className="text-right text-xs mt-1 text-slate-400">{pokemon.data.currentHp}/{pokemon.data.maxHp}</p>
            </div>
        </Card>
    );
};
