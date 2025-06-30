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
    onToggle: () => void;
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
const backendData: BackendData = {"player_name": "John", "play_time": {"hours": 45, "minutes": 36, "seconds": 40}, "active_slot": 14, "sector_map": {"2": 31, "3": 16, "4": 17, "5": 18, "6": 19, "7": 20, "8": 21, "9": 22, "10": 23, "11": 24, "12": 25, "13": 26, "14": 27, "15": 28, "0": 29, "1": 30}, "party_pokemon": [{"personality": 228, "otId": 3563855882, "nickname": "Steelix", "otName": "John", "currentHp": 131, "speciesId": 208, "item": 472, "move1": 446, "move2": 157, "move3": 91, "move4": 423, "pp1": 32, "pp2": 16, "pp3": 16, "pp4": 24, "hpEV": 76, "atkEV": 92, "defEV": 8, "speEV": 252, "spaEV": 60, "spdEV": 20, "ivs": [8, 9, 8, 11, 1, 9], "level": 44, "maxHp": 131, "attack": 102, "defense": 185, "speed": 63, "spAttack": 54, "spDefense": 68, "moves": {"move1": {"name": "Stealth Rock", "id": 446, "pp": 32}, "move2": {"name": "Rock Slide", "id": 157, "pp": 16}, "move3": {"name": "Dig", "id": 91, "pp": 16}, "move4": {"name": "Ice Fang", "id": 423, "pp": 24}}, "evs": [76, 92, 8, 252, 60, 20]}, {"personality": 531, "otId": 3563855882, "nickname": "Breloom", "otName": "John", "currentHp": 126, "speciesId": 286, "item": 0, "move1": 402, "move2": 92, "move3": 280, "move4": 73, "pp1": 24, "pp2": 16, "pp3": 24, "pp4": 16, "hpEV": 36, "atkEV": 124, "defEV": 132, "speEV": 148, "spaEV": 32, "spdEV": 36, "ivs": [30, 9, 3, 4, 2, 17], "level": 45, "maxHp": 126, "attack": 140, "defense": 93, "speed": 86, "spAttack": 69, "spDefense": 63, "moves": {"move1": {"name": "Seed Bomb", "id": 402, "pp": 24}, "move2": {"name": "Toxic", "id": 92, "pp": 16}, "move3": {"name": "Brick Break", "id": 280, "pp": 24}, "move4": {"name": "Leech Seed", "id": 73, "pp": 16}}, "evs": [36, 124, 132, 148, 32, 36]}, {"personality": 745, "otId": 3563855882, "nickname": "Snorlax", "otName": "John", "currentHp": 248, "speciesId": 143, "item": 472, "move1": 34, "move2": 104, "move3": 214, "move4": 156, "pp1": 24, "pp2": 24, "pp3": 16, "pp4": 8, "hpEV": 224, "atkEV": 48, "defEV": 204, "speEV": 0, "spaEV": 32, "spdEV": 0, "ivs": [31, 31, 31, 0, 0, 31], "level": 47, "maxHp": 248, "attack": 128, "defense": 114, "speed": 33, "spAttack": 62, "spDefense": 122, "moves": {"move1": {"name": "Body Slam", "id": 34, "pp": 24}, "move2": {"name": "Double Team", "id": 104, "pp": 24}, "move3": {"name": "Sleep Talk", "id": 214, "pp": 16}, "move4": {"name": "Rest", "id": 156, "pp": 8}}, "evs": [224, 48, 204, 0, 32, 0]}, {"personality": 11, "otId": 3563855882, "nickname": "Ludicolo", "otName": "John", "currentHp": 135, "speciesId": 272, "item": 472, "move1": 240, "move2": 75, "move3": 72, "move4": 61, "pp1": 8, "pp2": 40, "pp3": 24, "pp4": 32, "hpEV": 44, "atkEV": 116, "defEV": 148, "speEV": 120, "spaEV": 52, "spdEV": 28, "ivs": [7, 24, 24, 25, 6, 21], "level": 45, "maxHp": 135, "attack": 91, "defense": 85, "speed": 101, "spAttack": 94, "spDefense": 107, "moves": {"move1": {"name": "Rain Dance", "id": 240, "pp": 8}, "move2": {"name": "Razor Leaf", "id": 75, "pp": 40}, "move3": {"name": "Mega Drain", "id": 72, "pp": 24}, "move4": {"name": "Bubble Beam", "id": 61, "pp": 32}}, "evs": [44, 116, 148, 120, 52, 28]}, {"personality": 247, "otId": 3563855882, "nickname": "Rayquaza", "otName": "John", "currentHp": 132, "speciesId": 6, "item": 466, "move1": 403, "move2": 225, "move3": 53, "move4": 108, "pp1": 24, "pp2": 32, "pp3": 24, "pp4": 32, "hpEV": 48, "atkEV": 120, "defEV": 112, "speEV": 156, "spaEV": 48, "spdEV": 24, "ivs": [30, 11, 17, 18, 23, 20], "level": 41, "maxHp": 132, "attack": 90, "defense": 87, "speed": 99, "spAttack": 108, "spDefense": 93, "moves": {"move1": {"name": "Air Slash", "id": 403, "pp": 24}, "move2": {"name": "Dragon Breath", "id": 225, "pp": 32}, "move3": {"name": "Flamethrower", "id": 53, "pp": 24}, "move4": {"name": "Smokescreen", "id": 108, "pp": 32}}, "evs": [48, 120, 112, 156, 48, 24]}, {"personality": 230, "otId": 3563855882, "nickname": "Sigilyph", "otName": "John", "currentHp": 114, "speciesId": 561, "item": 0, "move1": 403, "move2": 60, "move3": 314, "move4": 95, "pp1": 24, "pp2": 32, "pp3": 40, "pp4": 32, "hpEV": 60, "atkEV": 136, "defEV": 4, "speEV": 248, "spaEV": 36, "spdEV": 24, "ivs": [23, 25, 16, 22, 3, 4], "level": 37, "maxHp": 114, "attack": 62, "defense": 77, "speed": 107, "spAttack": 85, "spDefense": 67, "moves": {"move1": {"name": "Air Slash", "id": 403, "pp": 24}, "move2": {"name": "Psybeam", "id": 60, "pp": 32}, "move3": {"name": "Air Cutter", "id": 314, "pp": 40}, "move4": {"name": "Hypnosis", "id": 95, "pp": 32}}, "evs": [60, 136, 4, 248, 36, 24]}]};

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
const MoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, onToggle, opensUpward }) => {
    const popoverDirectionClass = opensUpward ? "bottom-full mb-1" : "top-full mt-1";
    const animationY = opensUpward ? 10 : -10;

    return (
        <motion.div layout className={`relative ${isExpanded ? 'z-20' : 'z-0'}`}>
            <button onClick={onToggle} className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200 group cursor-pointer">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white group-hover:text-cyan-300 transition-colors">{move.name}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
                <div className="flex items-center justify-between mt-2">
                    {move.type ? <TypeBadge type={move.type} /> : <div className="h-[22px] w-16 bg-slate-700 rounded-md animate-pulse"></div>}
                    <span className="text-xs text-slate-300">{move.pp}/{move.pp}</span>
                </div>
            </button>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: animationY }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: animationY }}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className={`absolute ${popoverDirectionClass} left-0 right-0 z-50 p-3 bg-slate-900 backdrop-blur-md border border-slate-700 rounded-lg shadow-xl text-xs`}
                    >
                        <div className="flex justify-between text-slate-400 mb-2 pb-2 border-b border-slate-700/50">
                            <span>Power: <span className="text-white">{move.power ?? '—'}</span></span>
                            <span>Accuracy: <span className="text-white">{move.accuracy ? `${move.accuracy}%` : '—'}</span></span>
                        </div>
                        <p className="leading-relaxed text-slate-300 text-[8px]">{move.description || 'Loading description...'}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
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
    const movesContainerRef = useRef<HTMLDivElement>(null);

    const activePokemon = useMemo(() => partyList.find(p => p.id === activePokemonId), [partyList, activePokemonId]);

    // Effect to handle clicks outside of the moves container to close the popover
    useEffect(() => {
      if (!expandedMoveName) return;
      const handleClick = (e: MouseEvent) => {
        if (movesContainerRef.current && !movesContainerRef.current.contains(e.target as Node)) {
          setExpandedMoveName(null);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [expandedMoveName]);

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
                                    <div ref={movesContainerRef} className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {activePokemonDetails.moves.map((move, index) => 
                                            <MoveButton 
                                                key={move.name} 
                                                move={move} 
                                                isExpanded={expandedMoveName === move.name}
                                                onToggle={() => setExpandedMoveName(prev => prev === move.name ? null : move.name)}
                                                opensUpward={index < 2}
                                            />
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
                                        <p className="absolute inset-0 text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar p-4 text-[8px]">
                                            {activePokemonDetails.ability.description}
                                        </p>
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
