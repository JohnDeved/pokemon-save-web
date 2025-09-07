import { CheckIcon, ChevronsUpDownIcon, Pencil } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getStatAbbr, natureEffects, natures } from '@/lib/parser/core/utils'
import { cn } from '@/lib/utils'

export interface PokemonNatureComboboxProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  triggerClassName?: string
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  buttonSize?: React.ComponentProps<typeof Button>['size']
  hideIcon?: boolean
  asText?: boolean
}

export function PokemonNatureCombobox({ value, onChange, disabled = false, triggerClassName, buttonVariant = 'outline', buttonSize = 'sm', hideIcon = false, asText = false }: PokemonNatureComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [side, setSide] = React.useState<'top' | 'bottom'>('top')

  function decideSideFromEl(el: HTMLElement | null) {
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewportH = window.innerHeight
    const spaceBelow = viewportH - rect.bottom
    const spaceAbove = rect.top
    setSide(spaceBelow >= spaceAbove ? 'bottom' : 'top')
  }

  const label = value && natures.includes(value) ? value : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {asText ? (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            onClick={e => {
              if (!disabled) {
                decideSideFromEl(e.currentTarget)
                setOpen(true)
              }
            }}
            className={cn('group inline-flex items-center gap-1 cursor-pointer select-none bg-transparent p-0 m-0 rounded-none outline-none hover:text-foreground/80 focus-visible:ring-0 focus-visible:border-transparent', 'transition-colors', triggerClassName)}
            aria-label="Edit nature"
          >
            <span className="leading-none">{label ?? 'Nature'}</span>
            <Pencil className="ml-2 h-3.5 w-3.5 opacity-40 group-hover:opacity-80 group-focus:opacity-80 transition-opacity duration-150" />
          </button>
        ) : (
          <Button
            variant={buttonVariant}
            size={buttonSize}
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            onClick={e => {
              if (!disabled) {
                decideSideFromEl(e.currentTarget)
                setOpen(true)
              }
            }}
            className={cn(
              // Match menubar look & feel: use default button text size and geist font
              'justify-between w-[168px] border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 geist-font',
              triggerClassName
            )}
          >
            <span className="font-sans font-normal">{label ?? 'Nature'}</span>
            {!hideIcon && <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        avoidCollisions={false}
        className="w-[260px] p-0 geist-font group"
        onOpenAutoFocus={e => {
          // Ensure input receives focus when opened
          e.preventDefault()
          inputRef.current?.focus()
        }}
        onKeyDownCapture={() => {
          // Route any typing within the content to the input
          if (document.activeElement !== inputRef.current) inputRef.current?.focus()
        }}
      >
        <Command className="group-data-[side=top]:flex-col-reverse [&_[data-slot=command-input-wrapper]]:border-b group-data-[side=top]:[&_[data-slot=command-input-wrapper]]:border-t group-data-[side=top]:[&_[data-slot=command-input-wrapper]]:border-b-0">
          <CommandInput ref={inputRef} autoFocus placeholder="Search nature..." />
          <CommandList className="custom-scrollbar">
            <CommandEmpty>No nature found.</CommandEmpty>
            <CommandGroup>
              {natures.map(nature => {
                const effect = natureEffects[nature as keyof typeof natureEffects]
                const isSelected = value === nature
                return (
                  <CommandItem
                    key={nature}
                    value={nature}
                    onSelect={() => {
                      onChange(nature)
                      setOpen(false)
                    }}
                    onMouseDown={e => {
                      // cmdk keeps focus on the input by preventing default on mousedown.
                      // Handle selection here and prevent default to avoid focus/blur glitches.
                      e.preventDefault()
                      onChange(nature)
                      setOpen(false)
                    }}
                  >
                    <div className="flex w-full items-center">
                      <CheckIcon className={cn('mr-2 h-4 w-4 text-muted-foreground', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="mr-2 font-sans font-normal leading-5">{nature}</span>
                      <span className="ml-auto text-xs text-foreground/90 grid grid-cols-[auto_50px] items-center justify-items-end gap-2 font-sans shrink-0">
                        {effect ? (
                          <>
                            <span className="text-emerald-400">↑ {getStatAbbr(effect.increased)}</span>
                            <span className="text-rose-400">{getStatAbbr(effect.decreased)} ↓</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground col-span-2 text-right">Neutral</span>
                        )}
                      </span>
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
