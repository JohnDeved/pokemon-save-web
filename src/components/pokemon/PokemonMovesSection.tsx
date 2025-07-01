import React from 'react';
import { PokemonMoveButton } from './PokemonMoveButton';
import { Skeleton } from '../common';
import type { MoveWithDetails } from '../../types';

interface PokemonMovesProps {
    moves?: MoveWithDetails[];
    expandedMoveName?: string | null;
    onMoveHover?: (moveName: string | null) => void;
    isLoading?: boolean;
}

export const PokemonMovesSection: React.FC<PokemonMovesProps> = ({ 
    moves = [], 
    expandedMoveName = null, 
    onMoveHover,
    isLoading = false
}) => {
    if (isLoading || !moves.length) {
        return (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mimic exact PokemonMoveButton structure */}
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="group cursor-pointer">
                        <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200">
                            <div className="flex items-center justify-between">
                                <Skeleton.Text className="text-sm text-white">Move Name</Skeleton.Text>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                {/* Mimic PokemonTypeBadge */}
                                <Skeleton.Container className="inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br px-2 py-1 text-[8px] shadow-md">
                                    <Skeleton.Image className="w-3 h-3" />
                                    <Skeleton.Text>TYPE</Skeleton.Text>
                                </Skeleton.Container>
                                <Skeleton.Text className="text-xs text-slate-300">25/25</Skeleton.Text>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moves.map((move, index) => 
                <div 
                    key={move.name} 
                    className="group cursor-pointer"
                    onMouseEnter={() => onMoveHover?.(move.name)}
                    onMouseLeave={() => onMoveHover?.(null)}
                >
                    <PokemonMoveButton 
                        move={move} 
                        isExpanded={expandedMoveName === move.name}
                        opensUpward={index < 2}
                    />
                </div>
            )}
        </div>
    );
};
