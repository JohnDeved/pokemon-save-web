import React from 'react';
import type { TypeBadgeProps } from '../../types';

// Type-safe mapping for Pokemon type colors
const TYPE_COLORS: Record<string, string> = {
    GHOST: 'from-indigo-500 to-purple-600',
    GROUND: 'from-yellow-600 to-amber-700',
    GRASS: 'from-green-500 to-emerald-600',
    NORMAL: 'from-gray-400 to-gray-500',
    FIGHTING: 'from-red-600 to-rose-700',
    STEEL: 'from-slate-500 to-slate-600',
    FIRE: 'from-orange-500 to-red-600',
    WATER: 'from-blue-500 to-sky-600',
    FLYING: 'from-sky-400 to-cyan-500',
    BUG: 'from-lime-500 to-green-600',
    ROCK: 'from-stone-600 to-neutral-700',
    PSYCHIC: 'from-pink-500 to-fuchsia-600',
    FAIRY: 'from-pink-400 to-rose-400',
    ELECTRIC: 'from-yellow-400 to-amber-400',
    POISON: 'from-purple-500 to-fuchsia-600',
    ICE: 'from-cyan-300 to-sky-400',
    DRAGON: 'from-indigo-600 to-purple-700',
    DARK: 'from-neutral-800 to-gray-900',
    UNKNOWN: 'from-slate-600 to-slate-700'
} as const;

// Component for the colored Type Badge
export const PokemonTypeBadge: React.FC<TypeBadgeProps> = ({ type, isLarge = false }) => {
    const colorClass = TYPE_COLORS[type.toUpperCase()] || TYPE_COLORS['NORMAL'];
    const iconUrl = `https://cdn.jsdelivr.net/gh/duiker101/pokemon-type-svg-icons/icons/${type.toLowerCase()}.svg`;
    const sizeClasses = isLarge ? 'px-3 py-1 text-[10px]' : 'px-2 py-1 text-[8px]';
    
    return (
        <div className={`inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br ${colorClass} ${sizeClasses} shadow-md`}>
            <img src={iconUrl} alt={`${type} type icon`} className="w-3 h-3" />
            <span>{type.toUpperCase()}</span>
        </div>
    );
};
