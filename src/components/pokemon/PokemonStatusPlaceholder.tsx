import { cn } from '@/lib/utils'
import { Card } from '@/components/common'

export const PokemonStatusPlaceholder: React.FC = () => {
  return (
    <Card className={cn('flex items-center p-3 transition-all duration-300 border border-dashed border-zinc-800/60 bg-zinc-900/10')}>
      <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center">
        <span className="text-zinc-600 text-3xl font-bold">?</span>
      </div>
      <div className="flex-grow opacity-50">
        <div className="flex justify-between items-center text-sm">
          <h3 className="text-zinc-400">Empty Slot</h3>
        </div>
        <div className="w-full bg-zinc-900/30 border border-zinc-700 border-x-2 rounded-sm h-2.5 mt-2 overflow-hidden">
          <div className={cn('bg-gradient-to-r h-full')} style={{ width: '0%' }} />
        </div>
        <p className="text-right text-xs mt-1 text-zinc-500">-/-</p>
      </div>
    </Card>
  )
}
