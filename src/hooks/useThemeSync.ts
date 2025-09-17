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
    const body = document.body
    body.classList.remove('theme-zinc', 'theme-slate', 'theme-light')
    if (theme === 'slate') body.classList.add('theme-slate')
    else if (theme === 'light') body.classList.add('theme-light')
    else body.classList.add('theme-zinc')

    if (theme === 'light') body.classList.remove('dark')
    else body.classList.add('dark')

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (meta) {
      const color = theme === 'slate' ? '#0f172a' : theme === 'light' ? '#fafafa' : '#09090b'
      meta.content = color
    }

    if (hasFile && saveFileName) {
      document.title = `${saveFileName} — Pokemon Save Editor`
    } else {
      document.title = defaultTitle
    }
  }, [theme, hasFile, saveFileName, defaultTitle])
}
