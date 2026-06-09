import 'normalize.css/normalize.css'
import './globals.css'

import NextTopLoader from 'nextjs-toploader'
import React from 'react'

import ThemeProvider from '@/components/ThemeProvider'
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
  params
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale?: string }>
}>) => {
  const { locale = i18nConfig.defaultLocale } = await params
  const { resources } = await initTranslations(locale)
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          // Resolve the theme before hydration so the first paint matches the
          // user's saved preference. Prevents a light/dark flash (FOUC) and the
          // hydration mismatch on the mesh-gradient background layers.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme-preference')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`
          }}
        />
      </head>
      <body className="flex min-h-screen w-full flex-col">
        <NextTopLoader showSpinner={false} />
        <ThemeProvider>
          <TranslationsProvider locale={locale} resources={resources}>
            {children}
          </TranslationsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
