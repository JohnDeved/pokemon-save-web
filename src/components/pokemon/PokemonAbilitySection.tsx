import React from 'react';
import { ScrollableContainer, Skeleton } from '../common';
import type { Ability } from '../../types';

interface PokemonAbilitySectionProps {
    ability?: Ability;
    isLoading?: boolean;
}

export const PokemonAbilitySection: React.FC<PokemonAbilitySectionProps> = ({ 
    isLoading = false,
    ability,
}) => {

    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="flex flex-col h-full">
                <div className="text-xs p-4 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Skeleton.Text className="text-slate-300 bg-slate-700/80 px-2 py-1 rounded-md">Ability</Skeleton.Text>
                        <Skeleton.Text className="text-white">{ability?.name ?? 'Ability Name'}</Skeleton.Text>
                    </div>
                </div>
                <div className="relative flex-1">
                    <ScrollableContainer className="absolute inset-0 text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar p-4 text-[8px]">
                        <Skeleton.Text>
                            {ability?.description ?? 'This is a placeholder ability description that shows how the text will be laid out when the actual content loads. It mimics the typical length and structure of Pokemon ability descriptions.'}
                        </Skeleton.Text>
                    </ScrollableContainer>
                </div>
            </div>
        </Skeleton.LoadingProvider>
    );
};
