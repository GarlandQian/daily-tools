'use client'

import { createInstance } from 'i18next'
import { ReactNode, useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { initReactI18next } from 'react-i18next/initReactI18next'

import cn from '@/locales/cn.json'
import en from '@/locales/en.json'
import i18nConfig from '@/locales/i18nConfig'

// Keep dictionaries in a shared client bundle. Passing them from RootLayout as
// props embeds the entire catalog in every prerendered HTML and RSC segment.
const resources = {
  cn: { translation: cn },
  en: { translation: en }
}

export interface TranslationsProviderProps {
  children: ReactNode
  locale: string
}

export default function TranslationsProvider({ children, locale }: TranslationsProviderProps) {
  const i18n = useMemo(() => {
    const instance = createInstance()
    void instance.use(initReactI18next).init({
      fallbackLng: i18nConfig.defaultLocale,
      initImmediate: false,
      lng: locale,
      preload: [],
      resources,
      supportedLngs: i18nConfig.locales
    })
    return instance
  }, [locale])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
