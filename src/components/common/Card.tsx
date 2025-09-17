import { useSettingsStore } from '@/stores'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

const themeStyles: Record<string, { base: string; shadow: string }> = {
  slate: {
    base: 'bg-slate-800/50 border-slate-800',
    shadow: 'shadow-2xl',
  },
  light: {
    base: 'bg-zinc-50/80 border-zinc-300',
    shadow: 'shadow-md',
  },
  default: {
    base: 'bg-zinc-800/50 border-zinc-800',
    shadow: 'shadow-2xl',
  },
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  const theme = useSettingsStore(s => s.theme)
  const { base, shadow } = themeStyles[theme] ?? themeStyles.default
  return (
    <section
      {...props}
      className={cn(base, shadow, 'backdrop-blur-lg rounded-xl border relative', className)}
    >
      {children}
    </section>
  )
}
