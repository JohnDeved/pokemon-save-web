import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { cn } from '@/lib/utils'

const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(({ className, ...props }, ref) => (
  <CommandPrimitive ref={ref} data-slot="command" className={cn('bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md', className)} {...props} />
))
Command.displayName = CommandPrimitive.displayName

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-2 py-1" data-slot="command-input-wrapper">
    <CommandPrimitive.Input
      ref={ref}
      data-slot="command-input"
      className={cn('placeholder:text-muted-foreground flex h-9 w-full rounded-md bg-transparent py-2 text-sm leading-5 font-normal font-sans outline-none disabled:cursor-not-allowed disabled:opacity-50 placeholder:font-normal placeholder:tracking-normal', className)}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} data-slot="command-list" className={cn('max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar', className)} {...props} />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Empty>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty ref={ref} data-slot="command-empty" className={cn('py-6 text-center text-sm', className)} {...props} />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Group>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    data-slot="command-group"
    className={cn('text-foreground [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium px-1 py-1.5', className)}
    {...props}
  />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} data-slot="command-separator" className={cn('bg-border -mx-1 h-px', className)} {...props} />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    data-slot="command-item"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground relative flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm leading-5 font-normal font-sans outline-hidden data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span data-slot="command-shortcut" className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)} {...props} />
}

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut }
