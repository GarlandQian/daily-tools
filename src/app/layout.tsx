import 'normalize.css/normalize.css'
import './globals.css'

import React from 'react'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import i18nConfig from '@/locales/i18nConfig'
import initTranslations from '@/locales/i18n'
import TranslationsProvider from '@/components/TranslationsProvider'
import NextTopLoader from 'nextjs-toploader'

export const metadata = {
  title: "GarlandQian's Tools",
  description: "This is garlandQian's tools",
}

export function generateStaticParams() {
  return i18nConfig.locales.map((locale) => ({ locale }))
}

const RootLayout = async ({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode
  params: { locale: string }
}>) => {
  const { resources } = await initTranslations(locale)
  return (
    <html lang={locale}>
      <body className="flex min-h-screen w-full flex-col">
        <AntdRegistry>
          <NextTopLoader />
          <TranslationsProvider locale={locale} resources={resources}>
            {children}
          </TranslationsProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}

export default RootLayout
