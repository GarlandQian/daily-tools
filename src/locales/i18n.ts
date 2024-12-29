import { createInstance, i18n, Resource } from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next/initReactI18next'

import i18nConfig from './i18nConfig' // 引入之前的配置文件,根据实际情况修改路径

export default async function initTranslations(
  locale: string,
  i18nInstance?: i18n,
  resources?: Resource
) {
  i18nInstance = i18nInstance || createInstance()

  i18nInstance.use(initReactI18next)

  if (!resources) {
    const localeCache: Record<string, unknown> = {}
    const dynamicImport = async (language: 'en' | 'cn') => {
      if (localeCache[language]) {
        return localeCache[language]
      }

      const localeMap = {
        en: () => import('@/locales/en.json'),
        cn: () => import('@/locales/cn.json')
      }

      const loadLocale = localeMap[language] || localeMap['en']
      const localModule = await loadLocale()
      const localeData = localModule.default

      localeCache[language] = localeData // 缓存加载的语言文件
      return localeData
    }
    i18nInstance.use(
      resourcesToBackend(
        async (language: 'en' | 'cn') => await dynamicImport(language)
      )
    )
  }

  await i18nInstance.init({
    lng: locale,
    resources,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    preload: resources ? [] : i18nConfig.locales
  })

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore.data,
    t: i18nInstance.t
  }
}
