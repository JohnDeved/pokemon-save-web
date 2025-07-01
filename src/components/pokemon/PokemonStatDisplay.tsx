import React from 'react';
import { Skeleton } from '../common';
import type { StatDisplayProps } from '../../types';

// Constants for stat calculations
const MAX_EV = 252;
const STAT_NAMES = ['HP', 'ATK', 'DEF', 'SpA', 'SpD', 'SPE'] as const;

interface PokemonStatDisplayProps extends Partial<StatDisplayProps> {
    isLoading?: boolean;
}

// Component to display IVs and EVs
export const PokemonStatDisplay: React.FC<PokemonStatDisplayProps> = ({ 
    ivs, 
    evs, 
    baseStats, 
    isLoading = false 
}) => {
    if (isLoading || !ivs || !evs || !baseStats) {
        return (
            <div className="space-y-3 text-xs">
                {/* Mimic exact header structure */}
                <div className="grid grid-cols-10 gap-2 text-slate-400">
                    <Skeleton.Text className="col-span-1">STAT</Skeleton.Text>
                    <div className='col-span-6'></div>
                    <Skeleton.Text className="col-span-1 text-end">IV</Skeleton.Text>
                    <Skeleton.Text className="text-center">EV</Skeleton.Text>
                    <Skeleton.Text className="text-center">BASE</Skeleton.Text>
                </div>
                {/* Mimic exact stat row structure */}
                {STAT_NAMES.map((statName) => (
                    <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                        <Skeleton.Text className="text-white">{statName}</Skeleton.Text>
                        <div className="col-span-7 flex items-center gap-2">
                            <div className="w-full bg-slate-800/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-slate-700/50 animate-pulse h-full rounded-full w-3/4"></div>
                            </div>
                            <Skeleton.Text className="text-white w-8 text-right text-xs">252</Skeleton.Text>
                        </div>
                        <Skeleton.Text className="text-cyan-400 text-center text-sm">31</Skeleton.Text>
                        <Skeleton.Text className="text-slate-700 text-center text-sm">100</Skeleton.Text>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3 text-xs">
            <div className="grid grid-cols-10 gap-2 text-slate-400">
                <div className="col-span-1">STAT</div>
                <div className="col-span-7 text-end">IV</div>
                <div className="text-center">EV</div>
                <div className="text-center">BASE</div>
            </div>
            {STAT_NAMES.map((statName, index) => {
                const evPercentage = Math.min((evs[index] || 0) / MAX_EV * 100, 100);
                return (
                    <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                        <div className="text-white">{statName}</div>
                        <div className="col-span-7 flex items-center gap-2">
                            <div className="w-full bg-slate-800/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full" style={{ width: `${evPercentage}%`}}></div>
                            </div>
                            <span className="text-white w-8 text-right text-xs">{evs[index] || 0}</span>
                        </div>
                        <div className="text-cyan-400 text-center text-sm">{ivs[index] || 0}</div>
                        <div className="text-slate-700 text-center text-sm">{baseStats[index] || 0}</div>
                    </div>
                );
            })}
        </div>
    );
};
