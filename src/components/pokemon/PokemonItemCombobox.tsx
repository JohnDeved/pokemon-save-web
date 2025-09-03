import { CheckIcon, ChevronsUpDownIcon, Pencil } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import itemMapData from '@/lib/parser/games/quetzal/data/item_map.json'
import { cn } from '@/lib/utils'
import { getItemSpriteUrl } from '@/lib/parser/core/utils'
import { useSaveFileStore } from '@/stores'

type ItemEntry = { id: number; name: string; id_name: string }

const ITEMS: ItemEntry[] = Object.values(itemMapData as Record<string, any>)
  .filter((v: any) => v && typeof v.id === 'number' && v.id !== null)
  .map((v: any) => ({ id: v.id as number, name: v.name as string, id_name: v.id_name as string }))
  .sort((a, b) => a.name.localeCompare(b.name))

export interface PokemonItemComboboxProps {
  valueIdName?: string | null
  onChange: (item: { id: number; idName: string } | null) => void
  disabled?: boolean
  triggerClassName?: string
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  buttonSize?: React.ComponentProps<typeof Button>['size']
  hideIcon?: boolean
  asText?: boolean
}

export function PokemonItemCombobox({ valueIdName, onChange, disabled = false, triggerClassName, buttonVariant = 'outline', buttonSize = 'sm', hideIcon = false, asText = false }: PokemonItemComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [side, setSide] = React.useState<'top' | 'bottom'>('top')
  const parser = useSaveFileStore(state => state.parser)

  function decideSideFromEl(el: HTMLElement | null) {
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewportH = window.innerHeight
    setSide(viewportH - rect.bottom >= rect.top ? 'bottom' : 'top')
  }

  // Build item options from current game config when available; fallback to default Quetzal map
  const items: ItemEntry[] = React.useMemo(() => {
    const config = parser?.getGameConfig?.()
    const map = config?.mappings?.items
    if (map && map.size > 0) {
      const arr: ItemEntry[] = []
      for (const entry of map.values()) {
        const id = (entry as any).id as number | null
        if (id == null) continue
        arr.push({ id, name: (entry as any).name as string, id_name: (entry as any).id_name as string })
      }
      return arr.sort((a, b) => a.name.localeCompare(b.name))
    }
    return ITEMS
  }, [parser])

  const selected = valueIdName ? items.find(i => i.id_name === valueIdName) : undefined
  const label = selected?.name ?? 'None'

  const commonTriggerProps = {
    role: 'combobox' as const,
    'aria-expanded': open,
    disabled,
    onClick: (e: any) => {
      if (!disabled) {
        decideSideFromEl(e.currentTarget)
        setOpen(true)
      }
    },
  }

  const FALLBACK_URL = '/pokemon_item_placeholder_32x32.png'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {asText ? (
          <button
            type="button"
            {...commonTriggerProps}
            className={cn('group inline-flex items-center gap-1 cursor-pointer select-none bg-transparent p-0 m-0 rounded-none outline-none hover:text-slate-200 focus-visible:ring-0 focus-visible:border-transparent', 'transition-colors', triggerClassName)}
            aria-label="Edit held item"
          >
            <span className="leading-none">{label}</span>
            <Pencil className="ml-2 h-3.5 w-3.5 opacity-40 group-hover:opacity-80 group-focus:opacity-80 transition-opacity duration-150" />
          </button>
        ) : (
          <Button
            variant={buttonVariant}
            size={buttonSize}
            {...commonTriggerProps}
            className={cn('justify-between w-[220px] border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 geist-font', triggerClassName)}
          >
            <span className="font-sans font-normal">{label}</span>
            {!hideIcon && <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        avoidCollisions={false}
        className="w-[320px] p-0 geist-font group"
        onOpenAutoFocus={e => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        onKeyDownCapture={() => {
          if (document.activeElement !== inputRef.current) inputRef.current?.focus()
        }}
      >
        <Command className="group-data-[side=top]:flex-col-reverse [&_[data-slot=command-input-wrapper]]:border-b group-data-[side=top]:[&_[data-slot=command-input-wrapper]]:border-t group-data-[side=top]:[&_[data-slot=command-input-wrapper]]:border-b-0">
          <CommandInput ref={inputRef} autoFocus placeholder="Search item..." />
          <CommandList className="custom-scrollbar max-h-[50vh]">
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup heading="Held Item">
              <CommandItem
                key="none"
                value="none"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <div className="flex w-full items-center">
                  <CheckIcon className={cn('mr-2 h-4 w-4 text-muted-foreground', !selected ? 'opacity-100' : 'opacity-0')} />
                  <span className="mr-2 font-sans font-normal leading-5">None</span>
                </div>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Items">
              {items.map(item => {
                const isSelected = selected?.id === item.id
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.id_name}`}
                    onSelect={() => {
                      onChange({ id: item.id, idName: item.id_name })
                      setOpen(false)
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      onChange({ id: item.id, idName: item.id_name })
                      setOpen(false)
                    }}
                  >
                    <div className="flex w-full items-center gap-2">
                      <CheckIcon className={cn('h-4 w-4 text-muted-foreground', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <img
                        src={getItemSpriteUrl(item.id_name)}
                        alt=""
                        className="w-5 h-5 image-pixelate"
                        onError={e => {
                          const img = e.currentTarget as HTMLImageElement
                          img.onerror = null
                          img.src = FALLBACK_URL
                        }}
                      />
                      <span className="font-sans font-normal leading-5">{item.name}</span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
