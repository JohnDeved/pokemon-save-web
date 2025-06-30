import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hash, Pencil, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShaderBackground } from './components/ShaderBackground';

// --- Type Definitions ---
interface PlayTime {
    hours: number;
    minutes: number;
    seconds: number;
}

interface SectorMap {
    [key: string]: number;
}

interface BaseMove {
    name: string;
    id: number;
    pp: number;
}

interface Moves {
    move1: BaseMove;
    move2: BaseMove;
    move3: BaseMove;
    move4: BaseMove;
}

interface Pokemon {
    personality: number;
    otId: number;
    nickname: string;
    otName: string;
    currentHp: number;
    speciesId: number;
    item: number;
    move1: number;
    move2: number;
    move3: number;
    move4: number;
    pp1: number;
    pp2: number;
    pp3: number;
    pp4: number;
    hpEV: number;
    atkEV: number;
    defEV: number;
    speEV: number;
    spaEV: number;
    spdEV: number;
    ivs: number[];
    level: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
    moves: Moves;
    evs: number[];
    id: number;
    spriteUrl: string;
}

interface BackendData {
    player_name: string;
    play_time: PlayTime;
    active_slot: number;
    sector_map: SectorMap;
    party_pokemon: Omit<Pokemon, 'id' | 'spriteUrl'>[];
}

interface TypeBadgeProps {
    type: string;
    isLarge?: boolean;
}

interface PokemonStatusProps {
    pokemon: Pokemon;
    isActive: boolean;
}

interface MoveWithDetails extends BaseMove {
    type: string;
    description: string;
    power: number | null;
    accuracy: number | null;
}

interface MoveButtonProps {
    move: MoveWithDetails;
    isExpanded: boolean;
    opensUpward: boolean;
}

interface StatDisplayProps {
    ivs: number[];
    evs: number[];
}

interface Ability {
    name: string;
    description: string;
}

interface PokemonDetails {
    types: string[];
    ability: Ability;
    moves: MoveWithDetails[];
}

interface DetailedCache {
    [speciesId: number]: PokemonDetails;
}

interface PokeApiAbility {
    ability: {
        name: string;
        url: string;
    };
    is_hidden: boolean;
    slot: number;
}

interface PokeApiType {
    slot: number;
    type: {
        name: string;
        url: string;
    };
}

interface PokeApiEffectEntry {
    effect: string;
    language: {
        name: string;
        url: string;
    };
}

// --- Data Stub from Backend ---
// This is a sample data structure that mimics what a backend might provide.
const backendData: BackendData = {"player_name": "DRACULA", "play_time": {"hours": 46, "minutes": 54, "seconds": 19}, "active_slot": 14, "sector_map": {"12": 31, "13": 16, "14": 17, "15": 18, "0": 19, "1": 20, "2": 21, "3": 22, "4": 23, "5": 24, "6": 25, "7": 26, "8": 27, "9": 28, "10": 29, "11": 30}, "party_pokemon": [{"personality": 240, "otId": 1364199219, "nickname": "Bayleef", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 141, "unknown_25": [0, 0, 4], "speciesId": 153, "item": 0, "unknown_2C": [220, 224, 1, 0, 255, 27, 1, 0], "move1": 202, "move2": 219, "move3": 73, "move4": 77, "pp1": 16, "pp2": 40, "pp3": 16, "pp4": 56, "hpEV": 48, "atkEV": 128, "defEV": 116, "speEV": 128, "spaEV": 36, "spdEV": 52, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 64], "level": 50, "unknown_59": 255, "maxHp": 141, "attack": 88, "defense": 115, "speed": 96, "spAttack": 96, "spDefense": 107, "unknown_66": [34, 50], "displayOtId": "01843", "displayNature": "Modest", "moves": {"move1": {"name": "Giga Drain", "id": 202, "pp": 16}, "move2": {"name": "Safeguard", "id": 219, "pp": 40}, "move3": {"name": "Leech Seed", "id": 73, "pp": 16}, "move4": {"name": "Poison Powder", "id": 77, "pp": 56}}, "evs": [48, 128, 116, 128, 36, 52], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 508, "totalIvs": 186}, {"personality": 249, "otId": 1364199219, "nickname": "Flaaffy", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 94, "unknown_25": [0, 0, 4], "speciesId": 180, "item": 0, "unknown_2C": [148, 82, 0, 0, 255, 90, 1, 0], "move1": 486, "move2": 86, "move3": 84, "move4": 268, "pp1": 16, "pp2": 32, "pp3": 48, "pp4": 32, "hpEV": 76, "atkEV": 96, "defEV": 56, "speEV": 132, "spaEV": 56, "spdEV": 28, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 64], "level": 29, "unknown_59": 255, "maxHp": 94, "attack": 52, "defense": 49, "speed": 49, "spAttack": 64, "spDefense": 50, "unknown_66": [0, 0], "displayOtId": "01843", "displayNature": "Quirky", "moves": {"move1": {"name": "Electro Ball", "id": 486, "pp": 16}, "move2": {"name": "Thunder Wave", "id": 86, "pp": 32}, "move3": {"name": "Thunder Shock", "id": 84, "pp": 48}, "move4": {"name": "Charge", "id": 268, "pp": 32}}, "evs": [76, 96, 56, 132, 56, 28], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 444, "totalIvs": 186}, {"personality": 241, "otId": 1364199219, "nickname": "Noivern", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 139, "unknown_25": [0, 0, 4], "speciesId": 715, "item": 0, "unknown_2C": [224, 20, 1, 0, 255, 35, 1, 0], "move1": 162, "move2": 403, "move3": 44, "move4": 406, "pp1": 16, "pp2": 24, "pp3": 40, "pp4": 16, "hpEV": 32, "atkEV": 192, "defEV": 108, "speEV": 96, "spaEV": 44, "spdEV": 36, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 80], "level": 42, "unknown_59": 255, "maxHp": 139, "attack": 96, "defense": 86, "speed": 131, "spAttack": 114, "spDefense": 89, "unknown_66": [34, 50], "displayOtId": "01843", "displayNature": "Mild", "moves": {"move1": {"name": "Super Fang", "id": 162, "pp": 16}, "move2": {"name": "Air Slash", "id": 403, "pp": 24}, "move3": {"name": "Bite", "id": 44, "pp": 40}, "move4": {"name": "Dragon Pulse", "id": 406, "pp": 16}}, "evs": [32, 192, 108, 96, 44, 36], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 508, "totalIvs": 186}, {"personality": 235, "otId": 1364199219, "nickname": "Eevee", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 115, "unknown_25": [0, 0, 4], "speciesId": 133, "item": 463, "unknown_2C": [162, 42, 1, 0, 255, 33, 1, 0], "move1": 129, "move2": 98, "move3": 44, "move4": 28, "pp1": 32, "pp2": 48, "pp3": 40, "pp4": 24, "hpEV": 20, "atkEV": 244, "defEV": 116, "speEV": 56, "spaEV": 48, "spdEV": 24, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 80], "level": 43, "unknown_59": 255, "maxHp": 115, "attack": 81, "defense": 73, "speed": 78, "spAttack": 62, "spDefense": 76, "unknown_66": [17, 17], "displayOtId": "01843", "displayNature": "Timid", "moves": {"move1": {"name": "Swift", "id": 129, "pp": 32}, "move2": {"name": "Quick Attack", "id": 98, "pp": 48}, "move3": {"name": "Bite", "id": 44, "pp": 40}, "move4": {"name": "Sand Attack", "id": 28, "pp": 24}}, "evs": [20, 244, 116, 56, 48, 24], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 508, "totalIvs": 186}, {"personality": 1, "otId": 1364199219, "nickname": "Tinkaton", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 150, "unknown_25": [0, 0, 4], "speciesId": 1288, "item": 459, "unknown_2C": [110, 24, 1, 0, 255, 29, 1, 0], "move1": 577, "move2": 819, "move3": 583, "move4": 430, "pp1": 16, "pp2": 8, "pp3": 16, "pp4": 16, "hpEV": 132, "atkEV": 112, "defEV": 40, "speEV": 120, "spaEV": 76, "spdEV": 28, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 64], "level": 42, "unknown_59": 255, "maxHp": 150, "attack": 101, "defense": 77, "speed": 109, "spAttack": 84, "spDefense": 109, "unknown_66": [34, 50], "displayOtId": "01843", "displayNature": "Lonely", "moves": {"move1": {"name": "Draining Kiss", "id": 577, "pp": 16}, "move2": {"name": "Gigaton Hammer", "id": 819, "pp": 8}, "move3": {"name": "Play Rough", "id": 583, "pp": 16}, "move4": {"name": "Flash Cannon", "id": 430, "pp": 16}}, "evs": [132, 112, 40, 120, 76, 28], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 508, "totalIvs": 186}, {"personality": 23, "otId": 1364199219, "nickname": "Gligar", "unknown_12": [2, 2], "otName": "DRACULA", "unknown_1B": [0, 0, 0, 0, 0, 0, 1, 0], "currentHp": 124, "unknown_25": [0, 0, 4], "speciesId": 207, "item": 0, "unknown_2C": [28, 26, 1, 0, 255, 31, 1, 0], "move1": 404, "move2": 369, "move3": 342, "move4": 512, "pp1": 24, "pp2": 32, "pp3": 40, "pp4": 24, "hpEV": 20, "atkEV": 252, "defEV": 112, "speEV": 64, "spaEV": 32, "spdEV": 28, "unknown_46": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "ivData": 1073741823, "unknown_54": [0, 0, 0, 80], "level": 43, "unknown_59": 255, "maxHp": 124, "attack": 109, "defense": 120, "speed": 98, "spAttack": 45, "spDefense": 84, "unknown_66": [34, 50], "displayOtId": "01843", "displayNature": "Careful", "moves": {"move1": {"name": "X Scissor", "id": 404, "pp": 24}, "move2": {"name": "U-turn", "id": 369, "pp": 32}, "move3": {"name": "Poison Tail", "id": 342, "pp": 40}, "move4": {"name": "Acrobatics", "id": 512, "pp": 24}}, "evs": [20, 252, 112, 64, 32, 28], "ivs": [31, 31, 31, 31, 31, 31], "totalEvs": 508, "totalIvs": 186}]}
// --- UI Components ---

// Helper to map type names to colors and icons
const typeDetails: { [key: string]: { color: string } } = {
    GHOST: { color: 'from-indigo-500 to-purple-600' }, GROUND: { color: 'from-yellow-600 to-amber-700' }, GRASS: { color: 'from-green-500 to-emerald-600' }, NORMAL: { color: 'from-gray-400 to-gray-500' }, FIGHTING: { color: 'from-red-600 to-rose-700' }, STEEL: { color: 'from-slate-500 to-slate-600' }, FIRE: { color: 'from-orange-500 to-red-600' }, WATER: { color: 'from-blue-500 to-sky-600' }, FLYING: { color: 'from-sky-400 to-cyan-500' }, BUG: { color: 'from-lime-500 to-green-600' }, ROCK: { color: 'from-stone-600 to-neutral-700' }, PSYCHIC: { color: 'from-pink-500 to-fuchsia-600' }, FAIRY: { color: 'from-pink-400 to-rose-400' }, ELECTRIC: { color: 'from-yellow-400 to-amber-400' }, POISON: { color: 'from-purple-500 to-fuchsia-600' }, ICE: { color: 'from-cyan-300 to-sky-400' }, DRAGON: { color: 'from-indigo-600 to-purple-700' }, DARK: { color: 'from-neutral-800 to-gray-900' }, UNKNOWN: { color: 'from-slate-600 to-slate-700' }
};

// Component for the colored Type Badge
const TypeBadge: React.FC<TypeBadgeProps> = ({ type, isLarge = false }) => {
    const details = typeDetails[type.toUpperCase()] || typeDetails['NORMAL'];
    const iconUrl = `https://cdn.jsdelivr.net/gh/duiker101/pokemon-type-svg-icons/icons/${type.toLowerCase()}.svg`;
    const sizeClasses = isLarge ? 'px-3 py-1 text-[10px]' : 'px-2 py-1 text-[8px]';
    
    return (
        <div className={`inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br ${details.color} ${sizeClasses} shadow-md`}>
            <img src={iconUrl} alt={`${type} type icon`} className="w-3 h-3" />
            <span>{type.toUpperCase()}</span>
        </div>
    );
};

// Component for a single Pokémon's status display on the left
const PokemonStatus: React.FC<PokemonStatusProps> = ({ pokemon, isActive }) => {
    const hpPercentage = (pokemon.currentHp / pokemon.maxHp) * 100;
    const hpColor = hpPercentage > 50 ? 'from-green-400 to-emerald-500' : hpPercentage > 20 ? 'from-yellow-400 to-amber-500' : 'from-red-500 to-rose-600';

    const activeClasses = 'bg-slate-700/80 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30';
    const inactiveClasses = 'bg-slate-800/60 hover:bg-slate-700/60';

    return (
        <div className={`relative flex items-center p-3 rounded-xl transition-all duration-300 backdrop-blur-sm border border-slate-700 ${isActive ? activeClasses : inactiveClasses}`}>
            <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center">
                <img 
                    src={pokemon.spriteUrl} 
                    alt={pokemon.nickname} 
                    className={`w-full h-full object-contain transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ filter: 'drop-shadow(0px 4px 3px rgba(0,0,0,0.5)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.15))' }}
                    onError={(e) => { const target = e.target as HTMLImageElement; target.onerror = null; target.src=`https://placehold.co/96x96/334155/94a3b8?text=${String(pokemon.speciesId).padStart(3, '0')}`; }} 
                />
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-center text-sm">
                    <h3 className="text-white">{pokemon.nickname}</h3>
                    <span className="text-slate-300">Lv.{pokemon.level}</span>
                </div>
                <div className="w-full bg-slate-900/70 rounded-full h-2.5 mt-2 overflow-hidden">
                    <div className={`bg-gradient-to-r ${hpColor} h-full rounded-full transition-all duration-500`} style={{ width: `${hpPercentage}%` }}></div>
                </div>
                <p className="text-right text-xs mt-1 text-slate-400">{pokemon.currentHp}/{pokemon.maxHp}</p>
            </div>
        </div>
    );
};

// Component for a single move in the list
const MoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, opensUpward }) => {
    const popoverDirectionClass = opensUpward ? "bottom-full mb-1" : "top-full mt-1";
    const animationY = opensUpward ? 10 : -10;

    return (
        <motion.div layout className={`relative ${isExpanded ? 'z-20' : 'z-0'}`}>
            <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{move.name}</span>
                    {/* <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} /> */}
                </div>
                <div className="flex items-center justify-between mt-2">
                    {move.type ? <TypeBadge type={move.type} /> : <div className="h-[22px] w-16 bg-slate-700 rounded-md animate-pulse"></div>}
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
                        className={`absolute ${popoverDirectionClass} left-0 right-0 z-50 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs`}
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

// Reusable component for a scrollable container with dynamic fade effects
const ScrollableContainer: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    const [scrollState, setScrollState] = useState('none');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkScroll = () => {
            const el = containerRef.current;
            if (!el) return;

            const isScrollable = el.scrollHeight > el.clientHeight;
            if (!isScrollable) {
                setScrollState('none');
                return;
            }

            const atTop = el.scrollTop === 0;
            const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1; // More robust check

            if (atTop && !atBottom) {
                setScrollState('bottom');
            } else if (!atTop && atBottom) {
                setScrollState('top');
            } else if (!atTop && !atBottom) {
                setScrollState('both');
            } else {
                setScrollState('none');
            }
        };

        const el = containerRef.current;
        checkScroll(); // Initial check

        el?.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll); // Re-check on resize

        return () => {
            el?.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [children]); // Re-run effect if children change

    const fadeClass = {
        top: 'scroll-fade-top',
        bottom: 'scroll-fade-bottom',
        both: 'scroll-fade-both',
        none: ''
    }[scrollState];

    return (
        <div ref={containerRef} className={`scroll-container ${className} ${fadeClass}`}>
            {children}
        </div>
    );
};

// Component to display IVs and EVs
const StatDisplay: React.FC<StatDisplayProps> = ({ ivs, evs }) => {
    const statKeys = [ { name: 'HP', key: 'hp' }, { name: 'ATK', key: 'atk' }, { name: 'DEF', key: 'def' }, { name: 'SpA', key: 'spa' }, { name: 'SpD', key: 'spd' }, { name: 'SPE', key: 'spe' }];
    return (
        <div className="space-y-3 text-xs">
            <div className="grid grid-cols-4 gap-2 text-slate-400">
                <div className="col-span-1">STAT</div>
                <div className="text-center">IV</div>
                <div className="col-span-2 text-center">EV</div>
            </div>
            {statKeys.map((stat, index) => {
                const evPercentage = (evs[index] / 252) * 100;
                return (
                    <div key={stat.name} className="grid grid-cols-4 gap-2 items-center">
                        <div className="text-white">{stat.name}</div>
                        <div className="text-cyan-400 text-center text-sm">{ivs[index]}</div>
                        <div className="col-span-2 flex items-center gap-2">
                            <div className="w-full bg-slate-900/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full" style={{ width: `${evPercentage}%`}}></div>
                            </div>
                            <span className="text-white w-8 text-right text-xs">{evs[index]}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Loading Skeleton Component
const DetailsSkeleton = () => (
    <>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 animate-pulse">
            <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="h-8 w-32 bg-slate-700/50 rounded"></div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-7 w-20 bg-slate-700/50 rounded-full"></div>
                            <div className="h-7 w-20 bg-slate-700/50 rounded-full"></div>
                        </div>
                    </div>
                    <div className="h-7 w-16 bg-slate-700/50 rounded-full"></div>
                </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
                <div className="h-[70px] bg-slate-700/50 rounded-lg"></div>
            </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 p-4 animate-pulse">
            <div className="space-y-3 text-xs">
                <div className="h-4 w-full bg-slate-700/50 rounded"></div>
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-center">
                        <div className="h-4 w-10 bg-slate-700/50 rounded"></div>
                        <div className="h-5 w-6 bg-slate-700/50 rounded mx-auto"></div>
                        <div className="col-span-2 h-4 bg-slate-700/50 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 text-xs animate-pulse flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                 <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-slate-700/50 rounded-md"></div>
                    <div className="h-5 w-24 bg-slate-700/50 rounded"></div>
                </div>
            </div>
            <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 p-4 space-y-2">
                     <div className="h-3 w-full bg-slate-700/50 rounded"></div>
                     <div className="h-3 w-5/6 bg-slate-700/50 rounded"></div>
                </div>
            </div>
        </div>
    </>
);


// --- Main App Component ---
export default function App() {
    // Memoize the initial party list to prevent re-computation on re-renders.
    const initialPartyList = useMemo(() => backendData.party_pokemon.map((p, index): Pokemon => ({
        ...p,
        id: index,
        spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.speciesId}.png`
    })), []);

    const [partyList, setPartyList] = useState<Pokemon[]>(initialPartyList);
    const [activePokemonId, setActivePokemonId] = useState<number>(0);
    const [detailedCache, setDetailedCache] = useState<DetailedCache>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRenaming, setIsRenaming] = useState<boolean>(false);
    const [renameInput, setRenameInput] = useState<string>('');
    const [expandedMoveName, setExpandedMoveName] = useState<string | null>(null);

    const activePokemon = useMemo(() => partyList.find(p => p.id === activePokemonId), [partyList, activePokemonId]);

    // Effect to fetch detailed data for the active Pokémon.
    useEffect(() => {
        // When the active Pokémon changes, close any expanded move details.
        setExpandedMoveName(null);

        const fetchDetails = async () => {
            if (!activePokemon) return;

            // If we already have the data in our cache, use it and skip the API calls.
            if (detailedCache[activePokemon.speciesId]) {
                setIsLoading(false);
                return; 
            }

            setIsLoading(true);
            try {
                // **PERFORMANCE IMPROVEMENT**: Fetch Pokémon details and all move details in parallel.
                const [pokeRes, ...moveResults] = await Promise.all([
                    fetch(`https://pokeapi.co/api/v2/pokemon/${activePokemon.speciesId}`),
                    ...Object.values(activePokemon.moves).map(move => 
                        fetch(`https://pokeapi.co/api/v2/move/${move.id}`).then(res => res.json())
                    )
                ]);

                if (!pokeRes.ok) throw new Error(`Failed to fetch Pokémon: ${pokeRes.status}`);
                const pokeData = await pokeRes.json();

                // Fetch ability details. This is done after the main pokemon fetch to get the ability URL.
                const abilityUrl = pokeData.abilities.find((a: PokeApiAbility) => !a.is_hidden)?.ability.url;
                let abilityData = null;
                if (abilityUrl) {
                    const abilityRes = await fetch(abilityUrl);
                    if (abilityRes.ok) {
                        abilityData = await abilityRes.json();
                    }
                }
                
                // Process and format the fetched data.
                const types = pokeData.types.map((t: PokeApiType) => t.type.name.toUpperCase());
                const ability: Ability = abilityData ? {
                    name: abilityData.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    description: abilityData.effect_entries.find((e: PokeApiEffectEntry) => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, abilityData.effect_chance) || "No description available."
                } : { name: 'Unknown', description: 'Could not fetch ability data.' };

                const movesWithDetails: MoveWithDetails[] = Object.values(activePokemon.moves).map((move, i) => {
                    const result = moveResults[i];
                    return {
                        ...move,
                        type: result?.type?.name.toUpperCase() || 'UNKNOWN',
                        description: result?.effect_entries?.find((e: PokeApiEffectEntry) => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, result.effect_chance) || "No description available.",
                        power: result?.power,
                        accuracy: result?.accuracy,
                    };
                });
                
                // Update the cache with the new data.
                setDetailedCache(prev => ({ ...prev, [activePokemon.speciesId]: { types, ability, moves: movesWithDetails } }));

            } catch (error) {
                console.error("Failed to fetch Pokémon details:", error);
                // Set a fallback state in the cache in case of an error.
                setDetailedCache(prev => ({ 
                    ...prev, 
                    [activePokemon.speciesId]: { 
                        types: ['UNKNOWN'], 
                        ability: { name: 'Error', description: 'Could not fetch ability data.' }, 
                        moves: Object.values(activePokemon.moves).map((m): MoveWithDetails => ({ ...m, type: 'UNKNOWN', description: 'Could not load details.', power: null, accuracy: null })) 
                    } 
                }));
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [activePokemon, detailedCache]);

    const handleStartEditing = useCallback(() => {
        if (activePokemon) {
            setIsRenaming(true);
            setRenameInput(activePokemon.nickname);
        }
    }, [activePokemon]);

    const handleConfirmRename = useCallback(() => {
        if (renameInput.trim() && activePokemonId !== null) {
            setPartyList(prevList =>
                prevList.map(p =>
                    p.id === activePokemonId ? { ...p, nickname: renameInput.trim() } : p
                )
            );
        }
        setIsRenaming(false);
    }, [renameInput, activePokemonId]);
    
    const handleCancelRename = useCallback(() => {
        setIsRenaming(false);
    }, []);

    const activePokemonDetails = activePokemon ? detailedCache[activePokemon.speciesId] : null;
    
    return (
        <>
          <ShaderBackground />
            <div className="min-h-screen flex items-center justify-center p-4 font-pixel text-slate-100">
                <div className="absolute inset-0 z-[-2] h-screen w-screen bg-[#000000] bg-[radial-gradient(#ffffff33_1px,#00091d_1px)] bg-[size:20px_20px]"></div>
                <main className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 z-10">
                    <section className="flex flex-col gap-4">
                        {partyList.map(pokemon => (
                            <div key={pokemon.id} onClick={() => { if (!isRenaming) setActivePokemonId(pokemon.id); }} className="cursor-pointer group">
                               <PokemonStatus pokemon={pokemon} isActive={pokemon.id === activePokemonId} />
                            </div>
                        ))}
                    </section>
                    <div className="grid grid-rows-[auto_auto_1fr] gap-4 min-h-0">
                        {(!activePokemon || !activePokemonDetails || isLoading) ? <DetailsSkeleton /> : (
                             <>
                                <section className={`bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 z-30 relative`}>
                                    <div className="p-4 bg-slate-900/50 border-b border-slate-700 rounded-t-xl">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="h-8 flex items-center">
                                                    {isRenaming ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={renameInput}
                                                                onChange={(e) => setRenameInput(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') handleCancelRename(); }}
                                                                className="bg-slate-700/80 text-white text-xl p-1 rounded-md w-full h-full focus:outline-none focus:ring-2 focus:ring-cyan-400 tracking-tight"
                                                                autoFocus
                                                            />
                                                            <button onClick={handleConfirmRename} className="p-1 text-green-400 hover:bg-green-500/20 rounded-md"><Check size={16}/></button>
                                                            <button onClick={handleCancelRename} className="p-1 text-red-400 hover:bg-red-500/20 rounded-md"><X size={16}/></button>
                                                        </div>
                                                    ) : (
                                                        <h2 className="text-xl text-white tracking-tight flex items-center gap-2">
                                                            {activePokemon.nickname}
                                                            <Pencil
                                                                className="w-3 h-3 text-slate-400 hover:text-white cursor-pointer transition-colors"
                                                                onClick={handleStartEditing}
                                                            />
                                                        </h2>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {activePokemonDetails.types.map(type => <TypeBadge key={type} type={type} isLarge={true} />)}
                                                </div>
                                            </div>
                                            <span className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
                                                <Hash size={12} />
                                                {String(activePokemon.speciesId).padStart(3, '0')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {activePokemonDetails.moves.map((move, index) => 
                                            <div 
                                                key={move.name} 
                                                className="group cursor-pointer"
                                                onMouseEnter={() => setExpandedMoveName(move.name)}
                                                onMouseLeave={() => setExpandedMoveName(null)}
                                            >
                                                <MoveButton 
                                                    move={move} 
                                                    isExpanded={expandedMoveName === move.name}
                                                    opensUpward={index < 2}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </section>
                                <section className={`bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 p-4 ${expandedMoveName ? 'z-20' : 'z-20'} relative`}>
                                    <StatDisplay ivs={activePokemon.ivs} evs={activePokemon.evs} />
                                </section>
                                <section className="bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700 text-xs flex flex-col min-h-0 z-10">
                                     <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                                         <div className="flex items-center gap-2">
                                             <span className="text-slate-300 bg-slate-700/80 px-2 py-1 rounded-md">Ability</span>
                                             <span className="text-white">{activePokemonDetails.ability.name}</span>
                                         </div>
                                     </div>
                                    <div className="relative flex-1 min-h-0">
                                        <ScrollableContainer className="absolute inset-0 text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar p-4 text-[8px]">
                                            {activePokemonDetails.ability.description}
                                        </ScrollableContainer>
                                    </div>
                                </section>
                             </>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
