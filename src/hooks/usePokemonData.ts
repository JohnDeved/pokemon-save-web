import { useState, useEffect, useMemo } from 'react';
import type { 
    Pokemon, 
    DetailedCache, 
    MoveWithDetails, 
    Ability
} from '../types';
import { 
    PokemonTypeSchema, 
    PokemonApiResponseSchema, 
    MoveApiResponseSchema, 
    AbilityApiResponseSchema 
} from '../types';
import backendData from '../stub.json';

// Simple helper to safely parse Pokemon types from API
const parsePokemonType = (apiType: string) => {
    const result = PokemonTypeSchema.safeParse(apiType.toUpperCase());
    return result.success ? result.data : 'UNKNOWN';
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
                        fetch(`https://pokeapi.co/api/v2/move/${move.id}`)
                            .then(res => res.ok ? res.json() : null)
                            .catch(err => {
                                console.warn(`Failed to fetch move ${move.id}:`, err);
                                return null;
                            })
                    )
                ]);

                if (!pokeRes.ok) {
                    throw new Error(`Failed to fetch Pokémon: ${pokeRes.status}`);
                }
                
                const pokeData = await pokeRes.json();
                
                // Validate Pokemon API response with Zod
                const pokemonResult = PokemonApiResponseSchema.safeParse(pokeData);
                if (!pokemonResult.success) {
                    throw new Error('Invalid Pokemon API response format');
                }
                const validatedPokeData = pokemonResult.data;

                // Fetch ability details after getting the main pokemon data
                const abilityUrl = validatedPokeData.abilities.find(a => !a.is_hidden)?.ability.url;
                let abilityData = null;
                if (abilityUrl) {
                    const abilityRes = await fetch(abilityUrl);
                    if (abilityRes.ok) {
                        const rawAbilityData = await abilityRes.json();
                        const abilityResult = AbilityApiResponseSchema.safeParse(rawAbilityData);
                        if (abilityResult.success) {
                            abilityData = abilityResult.data;
                        }
                    }
                }
                
                // Process and format the fetched data with validated data
                const types = validatedPokeData.types.map(t => parsePokemonType(t.type.name));
                const baseStats = validatedPokeData.stats.map(stat => stat.base_stat);
                const ability: Ability = abilityData ? {
                    name: abilityData.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    description: abilityData.effect_entries?.find(e => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, String(abilityData.effect_chance || '')) || "No description available."
                } : { name: 'Unknown', description: 'Could not fetch ability data.' };

                const movesWithDetails: MoveWithDetails[] = Object.values(activePokemon.moves).map((move, i) => {
                    const result = moveResults[i];
                    
                    // Handle null/failed requests
                    if (!result) {
                        console.warn(`No data received for move ${move.name} (${move.id})`);
                        return {
                            ...move,
                            type: 'UNKNOWN',
                            description: 'Failed to load move details.',
                            power: null,
                            accuracy: null,
                        };
                    }

                    const moveValidation = MoveApiResponseSchema.safeParse(result);
                    
                    if (moveValidation.success) {
                        const validMove = moveValidation.data;
                        return {
                            ...move,
                            type: validMove.type?.name ? parsePokemonType(validMove.type.name) : 'UNKNOWN',
                            description: validMove.effect_entries?.find(e => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, String(validMove.effect_chance || '')) || "No description available.",
                            power: validMove.power ?? null,
                            accuracy: validMove.accuracy ?? null,
                        };
                    } else {
                        // Log validation errors for debugging
                        console.warn(`Move validation failed for move ${move.name}:`, moveValidation.error.issues);
                        
                        // Fallback to manual parsing for backwards compatibility
                        return {
                            ...move,
                            type: result?.type?.name ? parsePokemonType(result.type.name) : 'UNKNOWN',
                            description: result?.effect_entries?.find((e: { language: { name: string }; effect: string }) => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, String(result.effect_chance || '')) || "No description available.",
                            power: result?.power ?? null,
                            accuracy: result?.accuracy ?? null,
                        };
                    }
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
