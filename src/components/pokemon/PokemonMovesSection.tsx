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

const SKELETON_MOVES: MoveWithDetails[] = Array.from({ length: 4 }, (_, i) => ({
    id: i,
    name: `move-skeleton-${i}`,
    type: 'UNKNOWN',
    pp: 0,
    maxPp: 0,
    power: 0,
    accuracy: 0,
    description: '',
}));

export const PokemonMovesSection: React.FC<PokemonMovesProps> = ({ 
    moves = [], 
    expandedMoveName = null, 
    onMoveHover,
    isLoading = false
}) => {
    const renderMoves = isLoading ? SKELETON_MOVES : moves;
    return (
        <Skeleton.LoadingProvider loading={isLoading}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderMoves.map((move, i) => (
                    <div
                        key={isLoading ? i : move.name}
                        className="group cursor-pointer"
                        onMouseEnter={() => !isLoading && onMoveHover?.(move.name)}
                        onMouseLeave={() => !isLoading && onMoveHover?.(null)}
                    >
                        {isLoading ? (
                            <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <Skeleton.Text className="text-sm text-white">Move Name</Skeleton.Text>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br px-2 py-1 text-[8px] shadow-md">
                                        <Skeleton.Image className="w-3 h-3" />
                                        <Skeleton.Text>TYPE</Skeleton.Text>
                                    </div>
                                    <Skeleton.Text className="text-xs text-slate-300">25/25</Skeleton.Text>
                                </div>
                            </div>
                        ) : (
                            <PokemonMoveButton 
                                move={move} 
                                isExpanded={expandedMoveName === move.name}
                                opensUpward={i < 2}
                            />
                        )}
                    </div>
                ))}
            </div>
        </Skeleton.LoadingProvider>
    );
};
