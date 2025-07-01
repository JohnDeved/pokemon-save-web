import { useState, useEffect, useMemo } from 'react';
import type { 
    Pokemon, 
    DetailedCache, 
    MoveWithDetails, 
    Ability,
    PokemonType,
    PokeApiAbility,
    PokeApiType,
    PokeApiStat,
    PokeApiEffectEntry
} from '../types';
import backendData from '../stub.json';

// Type guard function to ensure we have a valid PokemonType
const isPokemonType = (type: string): type is PokemonType => {
    const validTypes: PokemonType[] = [
        'NORMAL', 'FIRE', 'WATER', 'ELECTRIC', 'GRASS', 'ICE', 
        'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 
        'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY', 'UNKNOWN'
    ];
    return validTypes.includes(type as PokemonType);
};

const normalizePokemonType = (apiType: string): PokemonType => {
    const upperType = apiType.toUpperCase();
    return isPokemonType(upperType) ? upperType : 'UNKNOWN';
};

export const usePokemonData = () => {
    // Memoize the initial party list to prevent re-computation on re-renders.
    const initialPartyList = useMemo(() => backendData.party_pokemon.map((p, index): Pokemon => ({
        ...p,
        id: index,
        spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.speciesId}.png`,
        baseStats: [0, 0, 0, 0, 0, 0] // Will be populated when fetching details
    })), []);

    const [partyList, setPartyList] = useState<Pokemon[]>(initialPartyList);
    const [activePokemonId, setActivePokemonId] = useState<number>(0);
    const [detailedCache, setDetailedCache] = useState<DetailedCache>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const activePokemon = useMemo(() => partyList.find(p => p.id === activePokemonId), [partyList, activePokemonId]);

    // Effect to fetch detailed data for the active Pokémon.
    useEffect(() => {
        if (!activePokemon || detailedCache[activePokemon.speciesId]) {
            setIsLoading(false);
            return; 
        }

        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                // Fetch Pokémon details and all move details in parallel for better performance
                const [pokeRes, ...moveResults] = await Promise.all([
                    fetch(`https://pokeapi.co/api/v2/pokemon/${activePokemon.speciesId}`),
                    ...Object.values(activePokemon.moves).map(move => 
                        fetch(`https://pokeapi.co/api/v2/move/${move.id}`).then(res => res.json())
                    )
                ]);

                if (!pokeRes.ok) {
                    throw new Error(`Failed to fetch Pokémon: ${pokeRes.status}`);
                }
                
                const pokeData = await pokeRes.json();

                // Fetch ability details after getting the main pokemon data
                const abilityUrl = pokeData.abilities.find((a: PokeApiAbility) => !a.is_hidden)?.ability.url;
                let abilityData = null;
                if (abilityUrl) {
                    const abilityRes = await fetch(abilityUrl);
                    if (abilityRes.ok) {
                        abilityData = await abilityRes.json();
                    }
                }
                
                // Process and format the fetched data
                const types = pokeData.types.map((t: PokeApiType) => normalizePokemonType(t.type.name));
                const baseStats = pokeData.stats.map((stat: PokeApiStat) => stat.base_stat);
                const ability: Ability = abilityData ? {
                    name: abilityData.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    description: abilityData.effect_entries.find((e: PokeApiEffectEntry) => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, abilityData.effect_chance) || "No description available."
                } : { name: 'Unknown', description: 'Could not fetch ability data.' };

                const movesWithDetails: MoveWithDetails[] = Object.values(activePokemon.moves).map((move, i) => {
                    const result = moveResults[i];
                    return {
                        ...move,
                        type: result?.type?.name ? normalizePokemonType(result.type.name) : 'UNKNOWN',
                        description: result?.effect_entries?.find((e: PokeApiEffectEntry) => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, result.effect_chance) || "No description available.",
                        power: result?.power,
                        accuracy: result?.accuracy,
                    };
                });
                
                // Update the cache with the new data
                setDetailedCache(prev => ({ 
                    ...prev, 
                    [activePokemon.speciesId]: { types, ability, moves: movesWithDetails, baseStats } 
                }));

                // Update the party list with base stats
                setPartyList(prevList =>
                    prevList.map(p =>
                        p.id === activePokemon.id ? { ...p, baseStats } : p
                    )
                );

            } catch (error) {
                console.error("Failed to fetch Pokémon details:", error);
                // Set a fallback state in the cache in case of an error
                setDetailedCache(prev => ({ 
                    ...prev, 
                    [activePokemon.speciesId]: { 
                        types: ['UNKNOWN'], 
                        ability: { name: 'Error', description: 'Could not fetch ability data.' }, 
                        moves: Object.values(activePokemon.moves).map((m): MoveWithDetails => ({ 
                            ...m, 
                            type: 'UNKNOWN',
                            description: 'Could not load details.', 
                            power: null, 
                            accuracy: null 
                        })),
                        baseStats: [0, 0, 0, 0, 0, 0]
                    } 
                }));
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [activePokemon, detailedCache]);

    const updatePokemonNickname = (pokemonId: number, newNickname: string) => {
        setPartyList(prevList =>
            prevList.map(p =>
                p.id === pokemonId ? { ...p, nickname: newNickname } : p
            )
        );
    };

    return {
        partyList,
        activePokemonId,
        setActivePokemonId,
        activePokemon,
        detailedCache,
        isLoading,
        updatePokemonNickname
    };
};
