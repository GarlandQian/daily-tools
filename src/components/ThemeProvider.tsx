'use client'

import { App, ConfigProvider, theme } from 'antd'
import React, { createContext, useContext, useEffect, useState } from 'react'

import themeConfig from '@/theme/themeConfig'

interface ThemeContextType {
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {}
})

export const useTheme = () => useContext(ThemeContext)

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize state lazily to avoid hydration mismatch and useEffect lint issues
  // Default to true (dark) if server-side or no preference
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('theme-preference')
    if (saved) {
      setIsDarkMode(saved === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('theme-preference', next ? 'dark' : 'light')
      return next
    })
  }

  const darkConfig = {
    token: {
      colorBgContainer: '#141414',
      colorBgLayout: '#000000',
    },
    components: {
      Layout: {
        headerBg: '#001529',
        bodyBg: '#000000',
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
      colorBgLayout: '#f0f2f5', // Standard AntD cool grey, very consistent
    },
    components: {
      Layout: {
        headerBg: '#ffffff',
        bodyBg: '#f0f2f5',
      },
      Card: {
         colorBgContainer: '#ffffff',
         border: '1px solid #f0f0f0'
      }
    }
  }

  // Prevent hydration mismatch by rendering a consistent server/client view first?
  // Actually, standard AntD practice is just to pass the config.

  const currentTheme = {
    ...themeConfig,
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...themeConfig.token,
      ...(isDarkMode ? darkConfig.token : lightConfig.token),
    },
    components: {
      ...themeConfig.components,
      ...(isDarkMode ? darkConfig.components : lightConfig.components),
    }
  }

  if (!mounted) {
      return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ConfigProvider theme={currentTheme}>
        <App>
          {children}
        </App>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
