import { useEffect } from 'react'

type ThemeValue = 'zinc' | 'slate' | 'light'

interface UseThemeSyncOptions {
  theme: ThemeValue
  hasFile: boolean
  saveFileName?: string | null
  defaultTitle: string
}

export function useThemeSync({ theme, hasFile, saveFileName, defaultTitle }: UseThemeSyncOptions) {
  useEffect(() => {
    const { body } = document
    const themeClasses: Record<ThemeValue, string> = {
      slate: 'theme-slate',
      light: 'theme-light',
      zinc: 'theme-zinc',
    }
    body.classList.remove('theme-zinc', 'theme-slate', 'theme-light')
    body.classList.add(themeClasses[theme])

    if (theme === 'light') body.classList.remove('dark')
    else body.classList.add('dark')

    const themeColors: Record<ThemeValue, string> = {
      slate: '#0f172a',
      light: '#fafafa',
      zinc: '#09090b',
    }

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (meta) {
      meta.content = themeColors[theme]
    }

    if (hasFile && saveFileName) {
      document.title = `${saveFileName} — Pokemon Save Editor`
    } else {
      document.title = defaultTitle
    }
  }, [theme, hasFile, saveFileName, defaultTitle])
}
