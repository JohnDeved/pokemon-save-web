# Generate Vanilla Pokémon Emerald Mappings

This script generates mapping files for vanilla Pokémon Emerald by parsing the official pokeemerald source code and mapping it to PokeAPI data.

## Usage

```bash
npm run generate-mappings
```

Or run the script directly:

```bash
node scripts/generate-vanilla-mappings.js
```

## What it does

1. **Fetches pokeemerald source files** from the official repository:
   - `include/constants/species.h` - Pokemon species constants
   - `include/constants/moves.h` - Move constants  
   - `include/constants/items.h` - Item constants

2. **Parses pokeemerald constants** to extract internal IDs and names:
   - `SPECIES_TREECKO 277` → maps to internal ID 277 with name "TREECKO"
   - `MOVE_POUND 1` → maps to internal ID 1 with name "POUND"
   - `ITEM_POTION 13` → maps to internal ID 13 with name "POTION"

3. **Fetches PokeAPI data** for Pokemon, moves, and items

4. **Creates mappings** that map pokeemerald internal IDs to PokeAPI data:
   ```json
   {
     "277": {
       "name": "Treecko",
       "id_name": "treecko", 
       "id": 252
     }
   }
   ```

5. **Generates mapping files** in `src/lib/parser/games/vanilla/data/`:
   - `pokemon_map.json` - Pokemon species mappings
   - `move_map.json` - Move mappings
   - `item_map.json` - Item mappings

## Output

The script generates comprehensive mapping files that allow the vanilla Pokemon Emerald parser to correctly translate internal game IDs to standard Pokemon data:

- **Pokemon**: 385+ mappings (e.g., internal ID 277 → Treecko with PokeAPI ID 252)
- **Moves**: 351+ mappings (e.g., internal ID 1 → Pound)  
- **Items**: 298+ mappings (e.g., internal ID 13 → Potion)

These mappings ensure that save files from vanilla Pokemon Emerald display the correct Pokemon names, move names, and item names that match the official Pokemon data.

## Sources

- **pokeemerald constants**: https://github.com/pret/pokeemerald/tree/master/include/constants
- **PokeAPI data**: https://pokeapi.co/api/v2/