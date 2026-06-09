type NumberFormatterMode = 'decimal' | 'integer' | 'money' | 'percent'

const formatterCache = new Map<string, Intl.NumberFormat>()

const getLocale = (language: string) => (language === 'cn' ? 'zh-CN' : 'en-US')

const getNumberFormatter = (language: string, mode: NumberFormatterMode) => {
  const locale = getLocale(language)
  const key = `${locale}:${mode}`
  const cached = formatterCache.get(key)

  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: mode === 'integer' ? 0 : mode === 'percent' ? 1 : 2,
    minimumFractionDigits: mode === 'decimal' ? 2 : 0,
    ...(mode === 'percent' ? { style: 'percent' as const } : {})
  })

  formatterCache.set(key, formatter)
  return formatter
}

export const formatMoney = (value: number, language: string) =>
  getNumberFormatter(language, 'money').format(value)

export const formatDecimal = (value: number, language: string) =>
  getNumberFormatter(language, 'decimal').format(value)

export const formatInteger = (value: number, language: string) =>
  getNumberFormatter(language, 'integer').format(value)

export const formatPercent = (value: number, language: string) =>
  getNumberFormatter(language, 'percent').format(value / 100)
