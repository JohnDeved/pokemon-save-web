import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { MoveButtonProps } from '../../types';
import { PokemonTypeBadge } from './PokemonTypeBadge';
import { ScrollableContainer } from '../common';

// Component for a single move in the list
export const PokemonMoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, opensUpward }) => {
    const popoverDirectionClass = opensUpward ? "bottom-full mb-1" : "top-full mt-1";
    const animationY = opensUpward ? 10 : -10;

    return (
        <motion.div layout className={cn("relative", isExpanded ? 'z-20' : 'z-0')}>
            <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{move.name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                    {move.type ? <PokemonTypeBadge type={move.type} /> : <div className="h-[22px] w-16 bg-slate-700 rounded-md animate-pulse"></div>}
                    <span className="text-xs text-slate-300">{move.pp}/{move.pp}</span>
                </div>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: animationY }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: animationY }}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className={cn("absolute left-0 right-0 z-50 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs", popoverDirectionClass)}
                    >
                        <div className="flex justify-between text-slate-400 mb-2 pb-2 border-b border-slate-700/50">
                            <div>Power: <div className="text-white">{move.power ?? '—'}</div></div>
                            <div>Accuracy: <div className="text-white">{move.accuracy ? `${move.accuracy}%` : '—'}</div></div>
                        </div>
                        <ScrollableContainer className="max-h-[100px] overflow-y-auto mt-2 custom-scrollbar text-slate-400 leading-relaxed text-[8px]">
                          {move.description || 'Loading description...'}
                        </ScrollableContainer>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
