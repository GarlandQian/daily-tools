'use client'

import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

import { ToastProvider } from '@/components/ui/toast'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  isDarkMode: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: () => {},
  isDarkMode: true
})

export const useTheme = () => useContext(ThemeContext)

const getSavedThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'

  const saved = localStorage.getItem('theme-preference') as ThemeMode | null
  return saved && ['light', 'dark', 'system'].includes(saved) ? saved : 'system'
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from deterministic defaults so the first client render matches the
  // server-rendered HTML (no hydration mismatch). The real preference is read
  // after mount; the inline boot script in the root layout already applies the
  // correct `data-theme` before hydration, so there is no visual flash.
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [mounted, setMounted] = useState(false)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeMode(getSavedThemeMode())
    setMounted(true)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('theme-preference', themeMode)
    }
  }, [themeMode, mounted])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode
  const isDarkMode = resolvedTheme === 'dark'

  useLayoutEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    }
  }, [isDarkMode, mounted])

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode }}>
      <ToastProvider>{children}</ToastProvider>
    </ThemeContext.Provider>
  )
}
