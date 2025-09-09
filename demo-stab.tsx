import { PokemonMoveButton } from '../src/components/pokemon/PokemonMoveButton'
import type { MoveWithDetails, PokemonType } from '../src/types'

// Demo moves for testing STAB
const demoMoves: MoveWithDetails[] = [
  {
    id: 1,
    name: 'Vine Whip',
    pp: 25,
    type: 'GRASS',
    description: 'Strikes the target with slender, whiplike vines.',
    power: 45,
    accuracy: 100,
    damageClass: 'physical',
    target: 'selected-pokemon',
  },
  {
    id: 2,
    name: 'Tackle',
    pp: 35,
    type: 'NORMAL',
    description: 'A physical attack in which the user charges and slams into the target.',
    power: 40,
    accuracy: 100,
    damageClass: 'physical',
    target: 'selected-pokemon',
  },
  {
    id: 3,
    name: 'Absorb',
    pp: 25,
    type: 'GRASS',
    description: 'A nutrient-draining attack. The user recovers half the HP drained from the target.',
    power: 20,
    accuracy: 100,
    damageClass: 'special',
    target: 'selected-pokemon',
  },
  {
    id: 4,
    name: 'Quick Attack',
    pp: 30,
    type: 'NORMAL',
    description: 'The user lunges at the target at a speed that makes it almost invisible.',
    power: 40,
    accuracy: 100,
    damageClass: 'physical',
    target: 'selected-pokemon',
  },
]

// Treecko is a Grass-type Pokemon
const treeckoTypes: PokemonType[] = ['GRASS']

export const StabDemo = () => {
  return (
    <div className="p-6 bg-zinc-900 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">STAB (Same Type Attack Bonus) Demo</h1>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Pokemon: TREECKO (Grass Type)</h2>
        <p className="text-gray-300 text-sm mb-4">When a Pokemon uses a move that matches its type, it gets a 1.5x power bonus (STAB). Hover over the moves below to see the power adjustment in the popover.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        {demoMoves.map((move, index) => (
          <div key={move.id} className="group">
            <PokemonMoveButton move={move} pokemonTypes={treeckoTypes} isExpanded={false} opensUpward={index < 2} />
            <div className="mt-2 p-2 bg-zinc-800 rounded text-xs text-gray-300">
              <div>
                Move Type: <span className="text-blue-400">{move.type}</span>
              </div>
              <div>
                Pokemon Types: <span className="text-green-400">{treeckoTypes.join(', ')}</span>
              </div>
              <div>STAB: {treeckoTypes.includes(move.type) ? <span className="text-green-400">YES (1.5x)</span> : <span className="text-red-400">NO</span>}</div>
              <div>
                Power: {move.power} → {treeckoTypes.includes(move.type) ? <span className="text-green-400">{Math.floor(move.power! * 1.5)}</span> : move.power}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-zinc-800 rounded">
        <h3 className="text-lg font-semibold text-white mb-2">Expected Results:</h3>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>
            • <strong>Vine Whip</strong> (Grass): 45 → <span className="text-green-400">67</span> (STAB applies)
          </li>
          <li>
            • <strong>Tackle</strong> (Normal): 40 → 40 (No STAB)
          </li>
          <li>
            • <strong>Absorb</strong> (Grass): 20 → <span className="text-green-400">30</span> (STAB applies)
          </li>
          <li>
            • <strong>Quick Attack</strong> (Normal): 40 → 40 (No STAB)
          </li>
        </ul>
      </div>
    </div>
  )
}
