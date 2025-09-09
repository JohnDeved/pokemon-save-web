import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const toasterStyle: React.CSSProperties = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
} as React.CSSProperties

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const normalizedTheme: ToasterProps['theme'] = theme === 'dark' || theme === 'light' || theme === 'system' ? theme : 'system'

  return <Sonner theme={normalizedTheme} className="toaster group" style={toasterStyle} {...props} />
}

export { Toaster }
