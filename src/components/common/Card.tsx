import { cn } from '../../lib/utils'
import { useSettingsStore } from '@/stores'

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  const theme = useSettingsStore(s => s.theme)
  const base =
    theme === 'slate'
      ? 'bg-slate-800/50 border-slate-800'
      : theme === 'light'
        ? 'bg-zinc-50/80 border-zinc-300'
        : 'bg-zinc-800/50 border-zinc-800'
  const shadow = theme === 'light' ? 'shadow-md' : 'shadow-2xl'
  return (
    <section {...props} className={cn(base, shadow, 'backdrop-blur-lg rounded-xl border relative', className)}>
      {children}
    </section>
  )
}
