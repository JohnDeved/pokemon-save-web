import { FaHashtag } from 'react-icons/fa6'
import { useRef } from 'react'
import { MousePointerClick } from 'lucide-react'
import { Skeleton } from '@/components/common'
import { PokemonTypeBadge } from '@/components/pokemon/PokemonTypeBadge'
import { useActivePokemonLoading, useMegaPreview } from '@/hooks'
import { usePokemonStore } from '@/stores'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Button } from '../ui/button'
import { CursorFollowHint } from '@/components/common/CursorFollowHint'
// Nature editing moved to Traits section's Nature tab

export const PokemonHeader: React.FC = () => {
  const isLoading = useActivePokemonLoading()
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const megaAnchorRef = useRef<HTMLElement | null>(null)
  const { supportsMega, hasMegaForms, megaPreviewEnabled, setMegaPreviewEnabled, forms, selectedForm, setSelectedForm, statsLoading, megaTypes } = useMegaPreview()
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-3 border-b border-border">
        {/* Row 1: Name (+ Mega controls) and Dex ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-h-[28px]">
            <h2 className="font-pixel text-xl text-foreground leading-none flex items-center gap-2">
              {pokemon?.data.nickname}
              {/* Shiny/Radiant icons temporarily disabled */}
            </h2>
            {supportsMega && (
              <span ref={megaAnchorRef} className="relative inline-flex w-7 h-7 overflow-visible">
                {hasMegaForms ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-7 p-0"
                    aria-pressed={megaPreviewEnabled}
                    aria-label={megaPreviewEnabled ? 'Disable Mega Preview' : 'Enable Mega Preview'}
                    onClick={() => !statsLoading && setMegaPreviewEnabled(!megaPreviewEnabled)}
                    disabled={statsLoading}
                  >
                    <img src="/mega.svg" alt="Mega Evolution" className={`w-4 h-4 transition-all ${megaPreviewEnabled ? '' : 'filter grayscale contrast-75 brightness-90 opacity-70'}`} draggable={false} />
                  </Button>
                ) : (
                  <span className="inline-block size-7 rounded-full opacity-0" aria-hidden />
                )}
                <CursorFollowHint anchorRef={megaAnchorRef} enabled={!statsLoading && hasMegaForms} once={false} requireOverflow={false} label={megaPreviewEnabled ? 'Mega Preview: On' : 'Mega Preview: Off'} icon={<MousePointerClick className="w-3.5 h-3.5" strokeWidth={2} />} />
              </span>
            )}
            {supportsMega && hasMegaForms && forms && forms.length > 1 && (
              <div className="flex items-center gap-2">
                <Select value={selectedForm} onValueChange={val => setSelectedForm(val)} disabled={!megaPreviewEnabled || statsLoading}>
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue placeholder="Choose Mega Form" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {forms.map((f: { value: string; label: string }) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="dark:bg-cyan-900/50 bg-cyan-100 dark:text-cyan-300 text-cyan-800 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border dark:border-cyan-800 border-cyan-300">
            <FaHashtag size={12} />
            <span>{String(pokemon?.data.speciesId).padStart(3, '0')}</span>
          </div>
        </div>
        {/* Row 2: Typing */}
        <div className="flex items-center justify-between mt-2 min-h-[25px]">
          <Skeleton.Container className="flex items-center gap-2 min-w-8">
            {isLoading && <PokemonTypeBadge type="UNKNOWN" isLarge />}
            {(megaPreviewEnabled && megaTypes && megaTypes.length ? megaTypes : pokemon?.details?.types || []).map(type => (
              <PokemonTypeBadge key={type} type={type} isLarge />
            ))}
          </Skeleton.Container>
          <div className="flex items-center gap-2 min-w-8" />
        </div>
      </div>
    </Skeleton.LoadingProvider>
  )
}
