'use client'

import { App, ConfigProvider, theme } from 'antd'
import React, { createContext, useContext, useEffect, useState } from 'react'

import themeConfig from '@/theme/themeConfig'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  isDarkMode: boolean // Keep for backward compatibility or ease of use
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

  const darkConfig = {
    token: {
      colorBgContainer: '#141414',
      colorBgLayout: '#000000'
    },
    components: {
      Layout: {
        headerBg: '#001529',
        bodyBg: '#000000'
      },
      Card: {
        colorBgContainer: '#1f1f1f',
        colorBorderSecondary: '#303030'
      }
    }
  }

  const lightConfig = {
    token: {
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f0f2f5'
    },
    components: {
      Layout: {
        headerBg: '#ffffff',
        bodyBg: '#f0f2f5'
      },
      Card: {
        colorBgContainer: '#ffffff',
        border: '1px solid #f0f0f0'
      }
    }
  }

  const currentTheme = {
    ...themeConfig,
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...themeConfig.token,
      ...(isDarkMode ? darkConfig.token : lightConfig.token)
    },
    components: {
      ...themeConfig.components,
      ...(isDarkMode ? darkConfig.components : lightConfig.components)
    }
  }

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode }}>
      <ConfigProvider theme={currentTheme}>
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
