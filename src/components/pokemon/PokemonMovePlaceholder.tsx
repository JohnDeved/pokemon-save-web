import { cn } from '@/lib/utils'

export const PokemonMovePlaceholder: React.FC = () => {
  return (
    <div className={cn('w-full text-left p-3 rounded-lg bg-transparent border border-dashed border-border flex flex-col justify-between min-h-[74px]')}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-semibold">——</span>
      </div>
      <div className="flex items-center justify-end mt-2">
        <span className="text-xs text-muted-foreground">-/-</span>
      </div>
    </div>
  )
}
