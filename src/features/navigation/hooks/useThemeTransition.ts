'use client'

import { type MouseEvent, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

import { type ThemeMode, useTheme } from '@/components/ThemeProvider'

import { startThemeChange } from '../theme-transition'

export function useThemeTransition() {
  const { themeMode, setThemeMode } = useTheme()
  const cleanup = useRef<(() => void) | undefined>(undefined)

  useEffect(() => () => cleanup.current?.(), [])

  const handleThemeChange = (mode: ThemeMode, event: MouseEvent<HTMLButtonElement>) => {
    // Also cancel a pending switch when the user reselects the current theme.
    cleanup.current?.()
    if (mode === themeMode) return
    cleanup.current = startThemeChange(
      () => flushSync(() => setThemeMode(mode)),
      event.clientX,
      event.clientY
    )
  }

  return { themeMode, handleThemeChange }
}
