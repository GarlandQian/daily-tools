'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { readLocalStorage, writeLocalStorage } from '@/utils/storage'

import {
  type DirectionMode,
  isDirectionMode,
  isSupportedLanguage,
  UI_DIRECTION_STORAGE_KEY,
  UI_LANGUAGE_STORAGE_KEY,
  UI_SIDEBAR_COLLAPSED_STORAGE_KEY
} from '../preferences'

export function useToolPreferences() {
  const {
    i18n: { language, changeLanguage }
  } = useTranslation()
  const [direction, setDirection] = useState<DirectionMode>('ltr')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const languageRestored = useRef(false)

  useLayoutEffect(() => {
    const savedDirection = readLocalStorage(UI_DIRECTION_STORAGE_KEY)
    const nextDirection = isDirectionMode(savedDirection) ? savedDirection : 'ltr'
    document.documentElement.setAttribute('dir', nextDirection)
    // Restore browser-only preferences after the deterministic hydration render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDirection(nextDirection)
    setSidebarCollapsed(readLocalStorage(UI_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    setReady(true)
  }, [])

  useEffect(() => {
    // Do not persist deterministic hydration defaults before restoring saved values.
    if (!ready) return
    document.documentElement.setAttribute('dir', direction)
    writeLocalStorage(UI_DIRECTION_STORAGE_KEY, direction)
    writeLocalStorage(UI_SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed))
  }, [direction, ready, sidebarCollapsed])

  useEffect(() => {
    if (languageRestored.current) return
    languageRestored.current = true
    const savedLanguage = readLocalStorage(UI_LANGUAGE_STORAGE_KEY)
    if (isSupportedLanguage(savedLanguage) && savedLanguage !== language) {
      void changeLanguage(savedLanguage).catch(() => {
        // Retain the loaded language if its optional saved replacement cannot load.
      })
    }
  }, [changeLanguage, language])

  useEffect(() => {
    document.documentElement.setAttribute('lang', language === 'cn' ? 'zh-CN' : 'en')
  }, [language])

  const handleLanguageChange = useCallback(() => {
    const nextLanguage = language === 'cn' ? 'en' : 'cn'
    writeLocalStorage(UI_LANGUAGE_STORAGE_KEY, nextLanguage)
    void changeLanguage(nextLanguage).catch(() => {
      // A failed locale load must not reject out of the button's event handler.
    })
  }, [changeLanguage, language])

  return {
    direction,
    language,
    sidebarCollapsed,
    handleLanguageChange,
    handleDirectionChange: () => setDirection(current => (current === 'ltr' ? 'rtl' : 'ltr')),
    toggleSidebarCollapsed: () => setSidebarCollapsed(current => !current)
  }
}
