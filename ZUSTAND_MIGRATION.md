# State Management Migration to Zustand

This document describes the migration from React's built-in state management (useReducer, useState, and context) to Zustand for improved performance and maintainability.

## Overview

The Pokemon Save Web application has been successfully migrated from:
- **Before**: useReducer and useState hooks with prop drilling
- **After**: Zustand stores for centralized state management

## Benefits Achieved

### 1. **Eliminated Prop Drilling**
- Components now access state directly from stores instead of receiving props from parents
- Simplified component interfaces and reduced prop passing complexity

### 2. **Improved Re-render Performance** 
- Components only re-render when the specific state they subscribe to changes
- Zustand's shallow equality checks prevent unnecessary re-renders
- Selective subscriptions optimize rendering across the app

### 3. **Centralized State Management**
- All shared/global state is now in dedicated stores
- Clear separation of concerns between UI state and business logic
- Easier debugging and state inspection

### 4. **Maintainable Architecture**
- Reduced boilerplate compared to useReducer patterns
- Type-safe store interfaces with TypeScript
- Simplified state update logic

## Stores Created

### 1. `useSaveFileStore`
Replaces the `useSaveFileParser` hook that used useReducer.

**State:**
- `saveData`: SaveData | null
- `isLoading`: boolean  
- `error`: string | null
- `hasFile`: boolean
- `lastParseFailed`: boolean
- `parser`: PokemonSaveParser | null

**Actions:**
- `parse(file: File)`: Parse a save file
- `clearSaveFile()`: Clear current save data
- `reconstructAndDownload(method)`: Save/download functionality

### 2. `usePokemonStore`  
Replaces Pokemon-related useState hooks from `usePokemonData`.

**State:**
- `activePokemonId`: number
- `partyList`: UIPokemonData[]

**Actions:**
- `setActivePokemonId(id)`: Set the active Pokemon
- `setEvIndex(pokemonId, statIndex, value)`: Update Pokemon EVs
- `setIvIndex(pokemonId, statIndex, value)`: Update Pokemon IVs  
- `setNature(pokemonId, nature)`: Update Pokemon nature
- `getRemainingEvs(pokemonId)`: Calculate remaining EV points

## Component Updates

All Pokemon-related components were updated to use Zustand stores directly:

- **PokemonHeader**: Uses `usePokemonStore` for Pokemon data and nature updates
- **PokemonStatDisplay**: Uses store for EV/IV management and active Pokemon
- **PokemonAbilitySection**: Uses store for active Pokemon abilities
- **PokemonMovesSection**: Uses store for active Pokemon moves
- **CompactPokemonSelector**: Uses store for party selection
- **PokemonPartyList**: Uses store for party management

## Compatibility Layer

To minimize breaking changes, compatibility hooks were created:
- `usePokemonData`: Maintains the same API but uses Zustand internally
- `useSaveFileParser`: Direct wrapper around `useSaveFileStore`

This allows gradual migration and maintains existing component interfaces.

## TanStack Query Integration

The existing TanStack Query integration for Pokemon API data fetching was preserved:
- Pokemon details are still cached efficiently
- API calls for moves, abilities, and sprites work unchanged
- Query invalidation and prefetching maintained

## Performance Improvements

### Before (useReducer/useState):
- Props passed through multiple component levels
- Components re-rendered when unrelated state changed
- Complex state update logic in reducers

### After (Zustand):
- Direct store access eliminates prop drilling
- Selective subscriptions reduce unnecessary re-renders
- Simplified state update functions
- Better TypeScript inference and autocomplete

## Testing

All existing tests continue to pass:
- ✅ 157 tests passing
- ✅ Build successful  
- ✅ No runtime errors
- ✅ All functionality preserved

## Future Benefits

This migration makes future development easier:
- Adding new features requires less prop threading
- State debugging is more straightforward  
- Component composition is more flexible
- Performance optimizations are easier to implement

The codebase is now better positioned for scaling and maintaining the Pokemon Save Web application.