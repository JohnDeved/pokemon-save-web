import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
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
}

export function PokemonNatureCombobox({ value, onChange, disabled = false, triggerClassName }: PokemonNatureComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const label = value && natures.includes(value) ? value : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            // Match menubar look & feel: use default button text size and geist font
            'justify-between w-[168px] border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50 geist-font',
            triggerClassName
          )}
        >
          <span className="font-sans font-normal">{label ?? 'Nature'}</span>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 geist-font"
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
        <Command>
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
