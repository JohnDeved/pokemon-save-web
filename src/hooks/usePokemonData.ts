import { useState, useEffect, useMemo } from 'react';
import type { UIPokemonData } from '../types';
import type { DetailedCache, MoveWithDetails, Ability } from '../types';
import { PokemonTypeSchema, PokemonApiResponseSchema, MoveApiResponseSchema, AbilityApiResponseSchema } from '../types';
import { useSaveFileParser } from './useSaveFileParser';
import { z } from 'zod';

// Helper to fetch and validate data from a URL
async function fetchAndValidate<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);

    const data = await response.json();
    const result = schema.safeParse(data);
    if (!result.success) throw new Error(`Invalid API response format for ${url}`);

    return result.data as T;
}

const fetchPokemonFromApi = (speciesId: number) =>
    fetchAndValidate(`https://pokeapi.co/api/v2/pokemon/${speciesId}`, PokemonApiResponseSchema);

const fetchMoveFromApi = (moveId: number) =>
    fetchAndValidate(`https://pokeapi.co/api/v2/move/${moveId}`, MoveApiResponseSchema);

const fetchAbilityFromApi = (abilityUrl: string) =>
    fetchAndValidate(abilityUrl, AbilityApiResponseSchema);

// Simple helper to safely parse Pokemon types from API
const parsePokemonType = (apiType: string) => {
    const result = PokemonTypeSchema.safeParse(apiType.toUpperCase());
    return result.success ? result.data : 'UNKNOWN';
};

function getInitialMovesWithDetails(moves: UIPokemonData['data']['moves']): MoveWithDetails[] {
    return [moves.move1, moves.move2, moves.move3, moves.move4].map(move => {
        if (move.id === 0) {
            return {
                pp: 0,
                id: 0,
                name: 'None',
                type: 'UNKNOWN', // Changed from 'NONE' to 'UNKNOWN' to match type
                description: 'No move assigned.',
                power: null,
                accuracy: null,
            };
        }
        return {
            pp: move.pp,
            id: move.id,
            name: 'Move #' + move.id,
            type: 'UNKNOWN',
            description: '',
            power: null,
            accuracy: null,
        };
    });
}

async function getPokemonDetails(pokemon: UIPokemonData) {
    const { data } = pokemon;

    const pokeData = await fetchPokemonFromApi(data.speciesId);
    const moveSources = [data.moves.move1, data.moves.move2, data.moves.move3, data.moves.move4];
    // Only fetch moves with id != 0, otherwise set to null
    const moveResults = await Promise.all(moveSources.map(move => move.id === 0 ? null : fetchMoveFromApi(move.id).catch(() => null)));
    const abilityUrl = pokeData.abilities.find(a => !a.is_hidden)?.ability.url;
    const abilityData = abilityUrl ? await fetchAbilityFromApi(abilityUrl).catch(() => null) : null;
    const types = pokeData.types.map(t => parsePokemonType(t.type.name));
    const baseStats = pokeData.stats.map(stat => stat.base_stat);

    const ability: Ability = abilityData ? {
        name: abilityData.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: abilityData.effect_entries?.find(e => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, String(abilityData.effect_chance || '')) || 'No description available.'
    } : { name: 'Unknown', description: 'Could not fetch ability data.' };

    const movesWithDetails: MoveWithDetails[] = moveSources.map((move, i) => {
        if (move.id === 0) {
            return {
                id: 0,
                name: 'None',
                pp: 0,
                type: 'UNKNOWN', // Changed from 'NONE' to 'UNKNOWN' to match type
                description: 'No move assigned.',
                power: null,
                accuracy: null,
            };
        }
        const validMove = moveResults[i];
        if (validMove) {
            return {
                id: move.id,
                name: validMove.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                pp: move.pp,
                type: validMove.type?.name ? parsePokemonType(validMove.type.name) : 'UNKNOWN',
                description: validMove.effect_entries?.find(e => e.language.name === 'en')?.effect.replace(/\$effect_chance/g, String(validMove.effect_chance || '')) || 'No description available.',
                power: validMove.power ?? null,
                accuracy: validMove.accuracy ?? null,
            };
        }
        return {
            id: move.id,
            name: `Move #${move.id}`,
            pp: move.pp,
            type: 'UNKNOWN',
            description: 'Failed to load move details.',
            power: null,
            accuracy: null,
        };
    });
    
    return { types, ability, movesWithDetails, baseStats };
}

export const usePokemonData = () => {
    const saveFileParser = useSaveFileParser();
    const { saveData } = saveFileParser;

    const initialPartyList = useMemo(() => {
        if (!saveData?.party_pokemon) return [];
        return saveData.party_pokemon.map((parsedPokemon, index): UIPokemonData => ({
            id: index,
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${parsedPokemon.speciesId}.png`,
            baseStats: [],
            data: parsedPokemon,
            movesWithDetails: getInitialMovesWithDetails(parsedPokemon.moves),
        }));
    }, [saveData]);

    const [partyList, setPartyList] = useState<UIPokemonData[]>(initialPartyList);
    const [activePokemonId, setActivePokemonId] = useState(0);
    const [detailedCache, setDetailedCache] = useState<DetailedCache>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setPartyList(initialPartyList);
        if (initialPartyList.length > 0) setActivePokemonId(0);
    }, [initialPartyList]);

    const activePokemon = useMemo(() => partyList.find(p => p.id === activePokemonId), [partyList, activePokemonId]);

    useEffect(() => {
        if (!activePokemon || detailedCache[activePokemon.data.speciesId]) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const { types, ability, movesWithDetails, baseStats } = await getPokemonDetails(activePokemon);
                if (cancelled) return;
                setDetailedCache(prev => ({ ...prev, [activePokemon.data.speciesId]: { types, ability, moves: movesWithDetails, baseStats } }));
                setPartyList(prevList => prevList.map(p =>
                    p.id === activePokemon.id ? {
                        ...p,
                        baseStats,
                        movesWithDetails,
                    } : p
                ));
            } catch {
                if (cancelled) return;
                setDetailedCache(prev => ({
                    ...prev,
                    [activePokemon.data.speciesId]: {
                        types: ['UNKNOWN'],
                        ability: { name: 'Error', description: 'Could not fetch ability data.' },
                        moves: getInitialMovesWithDetails(activePokemon.data.moves).map(m => ({ ...m, description: 'Could not load details.' })),
                        baseStats: [0, 0, 0, 0, 0, 0],
                    }
                }));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [activePokemon, detailedCache]);

    // Preload details for a given party member by id
    const preloadPokemonDetails = async (id: number) => {
        const pokemon = partyList.find(p => p.id === id);
        if (!pokemon) return;
        if (detailedCache[pokemon.data.speciesId]) return; // Already cached
        try {
            const { types, ability, movesWithDetails, baseStats } = await getPokemonDetails(pokemon);
            setDetailedCache(prev => ({ ...prev, [pokemon.data.speciesId]: { types, ability, moves: movesWithDetails, baseStats } }));
            setPartyList(prevList => prevList.map(p =>
                p.id === pokemon.id ? {
                    ...p,
                    baseStats,
                    movesWithDetails,
                } : p
            ));
        } catch {
            // Ignore errors for preloading
        }
    };

    return {
        partyList,
        activePokemonId,
        setActivePokemonId,
        activePokemon,
        detailedCache,
        isLoading,
        saveFileParser,
        preloadPokemonDetails, // Expose preloading
    };
};
