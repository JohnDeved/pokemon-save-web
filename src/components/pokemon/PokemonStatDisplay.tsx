import React from 'react';
import { Skeleton } from '../common';
import type { Pokemon } from '../../types';

// Constants for stat calculations
const MAX_EV = 252;
const STAT_NAMES = ['HP', 'ATK', 'DEF', 'SpA', 'SpD', 'SPE'] as const;

export interface PokemonStatDisplayProps {
    isLoading?: boolean;
    pokemon?: Pokemon;
}

// Component to display IVs and EVs
export const PokemonStatDisplay: React.FC<PokemonStatDisplayProps> = ({ 
    pokemon,
    isLoading = false
}) => {
    const ivs = pokemon?.data.ivs;
    const evs = pokemon?.data.evs;
    const baseStats = pokemon?.details?.baseStats;
    const totalStats = pokemon?.data.stats;
    const natureModifier = pokemon?.data.natureModifiersArray;

    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="p-4 space-y-2 text-xs">
                <div className="grid grid-cols-10 gap-2 text-slate-400">
                    <div className="col-span-1">STAT</div>
                    <div className="col-span-5 text-end">EV</div>
                    <div className="text-center">IV</div>
                    <div className="text-center">BASE</div>
                    <div className="text-right col-span-2">TOTAL</div>
                </div>
                {STAT_NAMES.map((statName, index) => {
                    const ev = evs?.[index] ?? 0;
                    const iv = ivs?.[index] ?? 0;
                    const base = baseStats?.[index] ?? 0;
                    const total = totalStats?.[index] ?? 0;
                    const evPercentage = Math.min(ev / MAX_EV * 100, 100);
                    const natureMod = natureModifier?.[index] ?? 1.0;
                    let statClass = 'text-slate-500';
                    if (natureMod > 1.0) statClass = 'text-green-400/50 font-bold';
                    else if (natureMod < 1.0) statClass = 'text-red-400/50 font-bold';
                    return (
                        <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                            <div className="text-white">{statName}</div>
                            <div className="col-span-5 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="w-full bg-slate-800/70 rounded-full h-2 overflow-hidden">
                                        <div
                                            className='bg-gradient-to-r from-cyan-500 to-blue-500 h-full'
                                            style={{ width: `${evPercentage}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="text-white w-8 text-right text-xs flex-shrink-0">{ev}</span>
                            </div>
                            <div className="text-cyan-400 text-center text-sm">{iv}</div>
                            <div className="text-slate-700 text-center text-sm"><Skeleton.Text>{isLoading ? 255 : base}</Skeleton.Text></div>
                            <div className={`col-span-2 text-right text-sm ${statClass}`}>{total}</div>
                        </div>
                    );
                })}
            </div>
        </Skeleton.LoadingProvider>
    );
};
