import React from 'react';
import { Card } from '../common/Card';
import { ScrollableContainer } from '../common';
import type { Ability } from '../../types';

interface PokemonAbilitySectionProps {
    ability: Ability;
}

export const PokemonAbilitySection: React.FC<PokemonAbilitySectionProps> = ({ ability }) => {
    return (
        <Card className="text-xs flex flex-col min-h-0 z-10">
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-slate-300 bg-slate-700/80 px-2 py-1 rounded-md">Ability</span>
                    <span className="text-white">{ability.name}</span>
                </div>
            </div>
            <div className="relative flex-1 min-h-0">
                <ScrollableContainer className="absolute inset-0 text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar p-4 text-[8px]">
                    {ability.description}
                </ScrollableContainer>
            </div>
        </Card>
    );
};
