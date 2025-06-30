import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hash, Pencil, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShaderBackground } from './components/ShaderBackground';
import backendData from './stub.json';
import type {
    Pokemon,
    TypeBadgeProps,
    PokemonStatusProps,
    MoveWithDetails,
    MoveButtonProps,
    StatDisplayProps,
    DetailedCache,
    PokeApiAbility,
    PokeApiType,
    PokeApiEffectEntry,
    Ability
} from './types';

// --- Data Stub from Backend ---
// This is a sample data structure that mimics what a backend might provide.
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
                <div className="col-span-2 text-end">IV</div>
                <div className="text-center">EV</div>
            </div>
            {statKeys.map((stat, index) => {
                const evPercentage = (evs[index] / 252) * 100;
                return (
                    <div key={stat.name} className="grid grid-cols-4 gap-2 items-center">
                        <div className="text-white">{stat.name}</div>
                        <div className="col-span-2 flex items-center gap-2">
                            <div className="w-full bg-slate-700/70 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full" style={{ width: `${evPercentage}%`}}></div>
                            </div>
                            <span className="text-white w-8 text-right text-xs">{evs[index]}</span>
                        </div>
                        <div className="text-cyan-400 text-center text-sm">{ivs[index]}</div>
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
