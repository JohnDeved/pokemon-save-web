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
    totalStats,
    isLoading = false 
}) => {
    if (isLoading || !ivs || !evs || !baseStats || !totalStats) {
        return (
            <div className="space-y-3 text-xs">
                <div className="grid grid-cols-10 gap-2 text-slate-400">
                    <span className="col-span-1"><Skeleton.Text>STAT</Skeleton.Text></span>
                    <div className="col-span-5"><span className="w-full flex justify-end"><Skeleton.Text>IV</Skeleton.Text></span></div>
                    <span className="text-center"><Skeleton.Text>EV</Skeleton.Text></span>
                    <span className="text-center"><Skeleton.Text>BASE</Skeleton.Text></span>
                    <span className="text-right col-span-2"><Skeleton.Text>TOTAL</Skeleton.Text></span>
                </div>
                {STAT_NAMES.map((statName) => (
                    <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                        <span className="text-white"><Skeleton.Text>{statName}</Skeleton.Text></span>
                        <div className="col-span-5 flex items-center gap-2">
                            <div className="w-full bg-slate-800/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-slate-700/50 animate-pulse h-full rounded-full w-3/4"></div>
                            </div>
                            <span className="text-white w-8 text-right text-xs"><Skeleton.Text>255</Skeleton.Text></span>
                        </div>
                        <span className="text-cyan-400 text-center text-sm"><Skeleton.Text>31</Skeleton.Text></span>
                        <span className="text-slate-700 text-center text-sm"><Skeleton.Text>255</Skeleton.Text></span>
                        <span className="text-slate-500 col-span-2 text-right text-sm"><Skeleton.Text>255</Skeleton.Text></span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="p-4 space-y-2 text-xs">
            <div className="grid grid-cols-10 gap-2 text-slate-400">
                <div className="col-span-1">STAT</div>
                <div className="col-span-5 text-end">IV</div>
                <div className="text-center">EV</div>
                <div className="text-center">BASE</div>
                <div className="text-right col-span-2">TOTAL</div>
            </div>
            {STAT_NAMES.map((statName, index) => {
                const evPercentage = Math.min((evs[index] || 0) / MAX_EV * 100, 100);
                return (
                    <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                        <div className="text-white">{statName}</div>
                        <div className="col-span-5 flex items-center gap-2">
                            <div className="w-full bg-slate-800/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full" style={{ width: `${evPercentage}%`}}></div>
                            </div>
                            <span className="text-white w-8 text-right text-xs">{evs[index] || 0}</span>
                        </div>
                        <div className="text-cyan-400 text-center text-sm">{ivs[index] || 0}</div>
                        <div className="text-slate-700 text-center text-sm">{baseStats[index] || 0}</div>
                        <div className="text-slate-500 col-span-2 text-right text-sm">{totalStats[index] || 0}</div>
                    </div>
                );
            })}
        </div>
    );
};
