import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import {
    PokemonApiResponseSchema,
    PokemonTypeSchema,
    MoveApiResponseSchema,
    AbilityApiResponseSchema,
    PokeApiFlavorTextEntrySchema,
    type AbilityApiResponse,
    type MoveApiResponse,
    type PokeApiFlavorTextEntry
} from '../types';
import type { Ability, MoveWithDetails, PokemonType, UIPokemonData } from '../types';
import { useSaveFileParser } from './useSaveFileParser';

// --- Constants ---
const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const UNKNOWN_TYPE: PokemonType = 'UNKNOWN';
const NO_MOVE: MoveWithDetails = {
    pp: 0,
    id: 0,
    name: 'None',
    type: UNKNOWN_TYPE,
    description: 'No move assigned.',
    power: null,
    accuracy: null,
};

// --- Utility Functions ---
const formatName = (name: string): string => name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const parsePokemonType = (apiType: string): PokemonType => {
    const result = PokemonTypeSchema.safeParse(apiType.toUpperCase());
    return result.success ? result.data : UNKNOWN_TYPE;
};

/**
 * Fetch and validate JSON from a URL using a Zod schema.
 */
async function fetchAndValidate<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
    const data = await response.json();
    const result = schema.safeParse(data);
    if (!result.success) throw new Error(`Invalid API response format for ${url}`);
    return result.data;
}

/**
 * Helper to get the best English description from effect_entries or flavor_text_entries.
 */
function getBestEnglishDescription(apiObj: MoveApiResponse | AbilityApiResponse): string {
    // Prefer effect_entries in English
    const effectEntry = apiObj.effect_entries?.find(e => e.language.name === 'en');
    if (effectEntry?.effect) return effectEntry.effect;

    // Fallback to latest English flavor_text_entry using Zod schema, but only keep the latest
    if (!Array.isArray(apiObj.flavor_text_entries)) return 'No description available.';

    let latest: PokeApiFlavorTextEntry | undefined;
    let latestId = -1;
    for (const entry of apiObj.flavor_text_entries) {
        const parsed = PokeApiFlavorTextEntrySchema.safeParse(entry);
        if (!(parsed.success && parsed.data.language.name === 'en')) continue;
        const match = parsed.data.version_group.url.match(/\/(\d+)\/?$/);
        const id = match ? parseInt(match[1], 10) : 0;
        if (id > latestId) {
            latest = parsed.data;
            latestId = id;
        }
    }
    if (latest) return latest.flavor_text.replace(/\s+/g, ' ').trim();
    return 'No description available.';
}

/**
 * Fetches all details for a Pokémon, including moves and abilities.
 */
async function getPokemonDetails(pokemon: UIPokemonData) {
    const { data } = pokemon;
    const pokeData = await fetchAndValidate(
        `https://pokeapi.co/api/v2/pokemon/${data.speciesId}`,
        PokemonApiResponseSchema
    );
    const moveSources = [data.moves.move1, data.moves.move2, data.moves.move3, data.moves.move4];
    const moveResults = await Promise.all(
        moveSources.map(move =>
            move.id === 0
                ? null
                : fetchAndValidate<MoveApiResponse>(`https://pokeapi.co/api/v2/move/${move.id}`, MoveApiResponseSchema).catch(() => null)
        )
    );
    const abilityEntries = pokeData.abilities;
    const abilities: Ability[] = await Promise.all(
        abilityEntries.map(async (entry) => {
            try {
                const abilityData = await fetchAndValidate<AbilityApiResponse>(
                    entry.ability.url,
                    AbilityApiResponseSchema
                );
                return {
                    slot: entry.slot,
                    name: formatName(abilityData.name),
                    description: getBestEnglishDescription(abilityData),
                };
            } catch {
                return { slot: entry.slot, name: entry.ability.name, description: 'Could not fetch ability data.' };
            }
        })
    );
    const types = pokeData.types.map((t) => parsePokemonType(t.type.name));
    const baseStats = pokeData.stats.map((stat) => stat.base_stat);
    const moves: MoveWithDetails[] = moveSources.map((move, i) => {
        if (move.id === 0) {
            return { ...NO_MOVE };
        }
        const validMove = moveResults[i] as MoveApiResponse | null;
        if (validMove) {
            return {
                id: move.id,
                name: formatName(validMove.name),
                pp: move.pp,
                type: validMove.type?.name ? parsePokemonType(validMove.type.name) : UNKNOWN_TYPE,
                description: getBestEnglishDescription(validMove),
                power: validMove.power ?? null,
                accuracy: validMove.accuracy ?? null,
            };
        }
        return {
            id: move.id,
            name: `Move #${move.id}`,
            pp: move.pp,
            type: UNKNOWN_TYPE,
            description: 'Failed to load move details.',
            power: null,
            accuracy: null,
        };
    });
    return { types, abilities, moves, baseStats };
}

/**
 * React hook for accessing and managing Pokémon party data and details.
 */
export const usePokemonData = () => {
    const saveFileParser = useSaveFileParser();
    const { saveData } = saveFileParser;
    const queryClient = useQueryClient();

    // Build the initial party list from save data
    const initialPartyList = useMemo(() => {
        if (!saveData?.party_pokemon) return [];
        return saveData.party_pokemon.map((parsedPokemon, index) => {
            const isShiny = parsedPokemon.shinyNumber > 0;
            const spriteUrl = isShiny
                ? `${SPRITE_BASE_URL}/shiny/${parsedPokemon.speciesId}.png`
                : `${SPRITE_BASE_URL}/${parsedPokemon.speciesId}.png`;
            return {
                id: index,
                spriteUrl,
                data: parsedPokemon
            };
        });
    }, [saveData]);

    // UI state: which Pokémon is active
    const [activePokemonId, setActivePokemonId] = useState(0);
    const activePokemon = useMemo(() =>
        initialPartyList.find((p) => p.id === activePokemonId),
        [initialPartyList, activePokemonId]
    );

    // Query for details of the active Pokémon
    const {
        data: detailedData,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['pokemon', 'details', String(activePokemonId)],
        queryFn: () => activePokemon ? getPokemonDetails(activePokemon) : Promise.reject('No active Pokémon'),
        enabled: !!activePokemon,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // Merge detailed data into the party list for UI
    const mergedPartyList: UIPokemonData[] = useMemo(() => {
        if (!detailedData || !activePokemon) return initialPartyList;
        return initialPartyList.map((p) =>
            p.id === activePokemon.id
                ? {
                    ...p,
                    details: detailedData,
                }
                : p
        );
    }, [initialPartyList, detailedData, activePokemon]);

    // Preload details for a given party member by id
    const preloadPokemonDetails = useCallback(
        async (id: number) => {
            const pokemon = initialPartyList.find((p) => p.id === id);
            if (!pokemon) return;
            await queryClient.prefetchQuery({
                queryKey: ['pokemon', 'details', String(id)],
                queryFn: () => getPokemonDetails(pokemon),
                staleTime: 1000 * 60 * 60,
            });
        },
        [initialPartyList, queryClient]
    );

    return {
        partyList: mergedPartyList,
        activePokemonId,
        setActivePokemonId,
        activePokemon: mergedPartyList.find((p) => p.id === activePokemonId),
        isLoading,
        isError,
        error,
        saveFileParser,
        preloadPokemonDetails,
    };
};
