import 'normalize.css/normalize.css'
import './globals.css'

import { AntdRegistry } from '@ant-design/nextjs-registry'
import NextTopLoader from 'nextjs-toploader'
import React from 'react'

import TranslationsProvider from '@/components/TranslationsProvider'
import initTranslations from '@/locales/i18n'
import i18nConfig from '@/locales/i18nConfig'

export const metadata = {
  title: "GarlandQian's Tools",
  description:
    "This is garlandQian's tools, include retirement date, hash encryption, encryption and decryption, file preview."
}

export function generateStaticParams() {
  return i18nConfig.locales.map(locale => ({ locale }))
}

const RootLayout = async ({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode
  params: { locale: string }
}>) => {
  const { resources } = await initTranslations(locale)
  return (
    <html lang={locale}>
      <body className="flex min-h-screen w-full flex-col">
        <AntdRegistry>
          <NextTopLoader showSpinner={false} />
          <TranslationsProvider locale={locale} resources={resources}>
            {children}
          </TranslationsProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}

export default RootLayout
