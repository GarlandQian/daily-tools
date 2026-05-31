'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

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

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [mounted, setMounted] = useState(false)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const saved = localStorage.getItem('theme-preference') as ThemeMode
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setThemeMode(saved)
    }
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

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    }
  }, [isDarkMode, mounted])

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode }}>
      <ToastProvider>
        {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
      </ToastProvider>
    </ThemeContext.Provider>
  )
}
