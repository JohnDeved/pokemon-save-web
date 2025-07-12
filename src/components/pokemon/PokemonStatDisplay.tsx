import React from 'react';
import { Skeleton } from '../common';
import type { Pokemon } from '../../types';
import { Slider } from '../ui/slider';

// Constants for stat calculations
const MAX_EV = 252;
const STAT_NAMES = ['HP', 'ATK', 'DEF', 'SPE', 'SpA', 'SpD'] as const;

export interface PokemonStatDisplayProps {
    isLoading?: boolean;
    setEvIndex: (pokemonId: number, statIndex: number, newValue: number) => void;
    pokemon?: Pokemon;
    getRemainingEvs?: (pokemonId: number) => number;
}

// Component to display IVs and EVs
export const PokemonStatDisplay: React.FC<PokemonStatDisplayProps> = ({ 
    pokemon,
    isLoading = false,
    setEvIndex,
    getRemainingEvs
}) => {
    const ivs = pokemon?.data.ivs;
    const evs = pokemon?.data.evs;
    const baseStats = pokemon?.details?.baseStats;
    const totalStats = pokemon?.data.stats;
    const natureModifier = pokemon?.data.natureModifiersArray;

    interface EVSliderProps {
        value: number;
        onChange: (newValue: number) => void;
    }
    // EVSlider with commit on release
    const EVSlider: React.FC<EVSliderProps> = React.memo(function EVSlider({ value, onChange }) {
        const [dragValue, setDragValue] = React.useState<number | null>(null);
        
        const currentValue = dragValue !== null ? dragValue : value;
        
        const handleValueChange = React.useCallback((val: number[]) => {
            const newValue = val[0];
            setDragValue(newValue);
        }, []);
        
        const handleValueCommit = React.useCallback((val: number[]) => {
            const finalValue = val[0];
            setDragValue(null);
            if (finalValue !== value) {
                onChange(finalValue);
            }
        }, [value, onChange]);
        
        return (
            <Slider
                value={[currentValue]}
                max={MAX_EV}
                onValueChange={handleValueChange}
                onValueCommit={handleValueCommit}
                className="[&_[data-slot=slider-track]]:bg-slate-800/70 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-cyan-500 [&_[data-slot=slider-range]]:to-blue-500"
            />
        );
    });

    // Handler for EV changes - direct updates for smooth dragging
    const handleEvChange = React.useCallback((statIndex: number, newValue: number) => {
        if (typeof pokemon?.id !== 'number') return;
        setEvIndex(pokemon.id, statIndex, newValue);
    }, [pokemon?.id, setEvIndex]);

    // Calculate remaining EVs for display
    const remainingEvs = pokemon?.id !== undefined && getRemainingEvs 
        ? getRemainingEvs(pokemon.id) 
        : 0;

    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="p-4 space-y-2 text-xs">
                {/* EV Budget Display */}
                <div className="flex justify-between items-center mb-3 p-2 bg-slate-800/50 rounded">
                    <span className="text-slate-400">Remaining EVs:</span>
                    <span className={`font-bold ${remainingEvs > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {remainingEvs}
                    </span>
                </div>
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
                    const natureMod = natureModifier?.[index] ?? 1.0;
                    let statClass = 'text-slate-500';
                    if (natureMod > 1.0) statClass = 'text-green-400/50 font-bold';
                    else if (natureMod < 1.0) statClass = 'text-red-400/50 font-bold';
                    return (
                        <div key={statName} className="grid grid-cols-10 gap-2 items-center">
                            <div className="text-white">{statName}</div>
                            <div className="col-span-5 flex items-center gap-2">
                                <EVSlider 
                                    value={ev} 
                                    onChange={newValue => handleEvChange(index, newValue)} 
                                />
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
