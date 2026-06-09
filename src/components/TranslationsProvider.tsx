'use client'

import { createInstance, Resource } from 'i18next'
import { ReactNode, useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { initReactI18next } from 'react-i18next/initReactI18next'

import i18nConfig from '@/locales/i18nConfig'

export interface TranslationsProviderProps {
  children: ReactNode
  locale: string
  namespaces?: string[]
  resources?: Resource
}

export default function TranslationsProvider({
  children,
  locale,
  resources
}: TranslationsProviderProps) {
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
  }, [locale, resources])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
