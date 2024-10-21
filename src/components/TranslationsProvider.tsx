'use client'

import { I18nextProvider } from 'react-i18next'
import { ReactNode } from 'react'
import initTranslations from '@/locales/i18n'
import { createInstance, Resource } from 'i18next'

export interface TranslationsProviderProps {
  children: ReactNode
  locale: string
  namespaces?: string[]
  resources?: Resource
}

export default function TranslationsProvider({ children, locale, resources }: TranslationsProviderProps) {
  const i18n = createInstance()

  initTranslations(locale, i18n, resources)

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}