import React from 'react';
import { PokemonMoveButton } from './PokemonMoveButton';
import type { MoveWithDetails } from '../../types';

interface PokemonMovesProps {
    moves: MoveWithDetails[];
    expandedMoveName: string | null;
    onMoveHover: (moveName: string | null) => void;
}

export const PokemonMovesSection: React.FC<PokemonMovesProps> = ({ 
    moves, 
    expandedMoveName, 
    onMoveHover 
}) => {
    return (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moves.map((move, index) => 
                <div 
                    key={move.name} 
                    className="group cursor-pointer"
                    onMouseEnter={() => onMoveHover(move.name)}
                    onMouseLeave={() => onMoveHover(null)}
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
