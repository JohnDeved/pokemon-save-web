import React from 'react';
import type { PokemonStatusProps } from '../../types';
import { Card } from '../common';

// Health percentage thresholds for color coding
const HP_THRESHOLDS = {
    HIGH: 50,
    LOW: 20
} as const;

// Component for a single Pokémon's status display on the left
export const PokemonStatus: React.FC<PokemonStatusProps> = ({ pokemon, isActive }) => {
    const hpPercentage = (pokemon.currentHp / pokemon.maxHp) * 100;
    const hpColor = hpPercentage > HP_THRESHOLDS.HIGH 
        ? 'from-green-400 to-emerald-500' 
        : hpPercentage > HP_THRESHOLDS.LOW 
            ? 'from-yellow-400 to-amber-500' 
            : 'from-red-500 to-rose-600';

    const containerClasses = isActive 
        ? 'bg-slate-700/80 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30'
        : 'bg-slate-800/60 hover:bg-slate-700/60';

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.onerror = null;
        target.src = `https://placehold.co/96x96/334155/94a3b8?text=${String(pokemon.speciesId).padStart(3, '0')}`;
    };

    return (
        <Card className={`flex items-center p-3 transition-all duration-300 ${containerClasses}`}>
            <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center">
                <img 
                    src={pokemon.spriteUrl} 
                    alt={pokemon.nickname} 
                    className={`w-full h-full object-contain transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ filter: 'drop-shadow(0px 4px 3px rgba(0,0,0,0.5)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.15))' }}
                    onError={handleImageError}
                />
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-center text-sm">
                    <h3 className="text-white">{pokemon.nickname}</h3>
                    <span className="text-slate-300">Lv.{pokemon.level}</span>
                </div>
                <div className="w-full bg-slate-900/70 rounded-full h-2.5 mt-2 overflow-hidden">
                    <div className={`bg-gradient-to-r ${hpColor} h-full rounded-full transition-all duration-500`} style={{ width: `${hpPercentage}%` }}></div>
                </div>
                <p className="text-right text-xs mt-1 text-slate-400">{pokemon.currentHp}/{pokemon.maxHp}</p>
            </div>
        </Card>
    );
};
