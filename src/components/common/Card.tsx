import { cn } from '../../lib/utils'
import { useSettingsStore } from '@/stores'

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  const theme = useSettingsStore(s => s.theme)
  const base = theme === 'slate' ? 'bg-slate-800/50 border-slate-800' : 'bg-zinc-800/50 border-zinc-800'
  return (
    <section {...props} className={cn(base, 'backdrop-blur-lg rounded-xl shadow-2xl border relative', className)}>
      {children}
    </section>
  )
}
