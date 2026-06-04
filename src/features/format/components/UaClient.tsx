'use client'

import {
  ClipboardList,
  Copy,
  Cpu,
  Globe,
  Info,
  Monitor,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2
} from 'lucide-react'
import { type ReactNode, useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { UAParser } from 'ua-parser-js'
import { Bots, Crawlers, InApps } from 'ua-parser-js/extensions'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface Section {
  icon: ReactNode
  title: string
  items: { label: string; value: string }[]
}

interface SampleUserAgent {
  key: string
  labelKey: string
  value: string
}

interface Signal {
  key: string
  labelKey: string
  active: boolean
}

const SAMPLE_USER_AGENTS: SampleUserAgent[] = [
  {
    key: 'chrome-desktop',
    labelKey: 'app.format.ua.sample.chrome',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  },
  {
    key: 'iphone-safari',
    labelKey: 'app.format.ua.sample.iphone',
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  },
  {
    key: 'android-chrome',
    labelKey: 'app.format.ua.sample.android',
    value:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
  },
  {
    key: 'googlebot',
    labelKey: 'app.format.ua.sample.bot',
    value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  }
]

const BOT_PATTERN = /\b(bot|crawler|spider|slurp|bingpreview|duckduckbot|baiduspider|yandex)\b/i
const WEBVIEW_PATTERN = /(; wv\)|\bwebview\b|version\/\d+\.\d+ chrome\/\d+.+mobile safari)/i
const IN_APP_PATTERN =
  /\b(FBAN|FBAV|FB_IAB|MicroMessenger|Line\/|Instagram|TikTok|Twitter|LinkedInApp|Alipay|Zalo)\b/i
const UA_EXTENSIONS = [Bots, Crawlers, InApps] as UAParser.UAParserExt

const subscribeToUserAgent = () => () => {}
const getClientUserAgent = () => navigator.userAgent
const getServerUserAgent = () => ''

function displayValue(value: string | undefined, fallback: string) {
  return value?.trim() || fallback
}

function getDeviceLabel(type: string | undefined, desktopLabel: string) {
  return type || desktopLabel
}

function getEngineFamily(browserName = '', engineName = '', userAgent = '') {
  const signature = `${browserName} ${engineName} ${userAgent}`.toLowerCase()
  if (signature.includes('firefox') || signature.includes('gecko')) return 'Gecko'
  if (signature.includes('safari') || signature.includes('webkit')) return 'WebKit'
  if (signature.includes('chrome') || signature.includes('edge') || signature.includes('blink')) {
    return 'Chromium'
  }
  return 'Unknown'
}

function getConfidenceScore(parsed: UAParser.IResult) {
  const fields = [
    parsed.browser.name,
    parsed.browser.version,
    parsed.engine.name,
    parsed.engine.version,
    parsed.os.name,
    parsed.os.version,
    parsed.device.type,
    parsed.device.vendor,
    parsed.device.model,
    parsed.cpu.architecture
  ]

  return fields.filter(Boolean).length
}

const UaClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const userAgent = useSyncExternalStore(
    subscribeToUserAgent,
    getClientUserAgent,
    getServerUserAgent
  )
  const [inputOverride, setInputOverride] = useState<string | null>(null)
  const input = inputOverride ?? userAgent
  const trimmedInput = input.trim()

  const parsed = useMemo(() => {
    if (!trimmedInput) return null
    return new UAParser(trimmedInput, UA_EXTENSIONS).getResult()
  }, [trimmedInput])

  const analysis = useMemo(() => {
    if (!parsed) return null

    const browserName = parsed.browser.name || ''
    const engineName = parsed.engine.name || ''
    const deviceType = parsed.device.type
    const family = getEngineFamily(browserName, engineName, trimmedInput)
    const score = getConfidenceScore(parsed)
    const confidenceKey =
      score >= 7
        ? 'app.format.ua.confidence.high'
        : score >= 4
          ? 'app.format.ua.confidence.medium'
          : 'app.format.ua.confidence.low'
    const browserType = parsed.browser.type?.toLowerCase()
    const isBot = BOT_PATTERN.test(trimmedInput) || browserType === 'crawler'
    const isWebView =
      WEBVIEW_PATTERN.test(trimmedInput) || browserName.toLowerCase().includes('webview')
    const isInApp = IN_APP_PATTERN.test(trimmedInput) || browserType === 'inapp'
    const isMobile = deviceType === 'mobile'
    const isTablet = deviceType === 'tablet'
    const isDesktop = !deviceType

    return {
      family,
      score,
      confidenceKey,
      isBot,
      isWebView,
      isInApp,
      isMobile,
      isTablet,
      isDesktop,
      length: trimmedInput.length
    }
  }, [parsed, trimmedInput])

  const sections = useMemo<Section[]>(() => {
    if (!parsed) return []

    return [
      {
        icon: <Globe className="h-4 w-4" />,
        title: t('app.format.ua.browser'),
        items: [
          {
            label: t('app.format.ua.name'),
            value: displayValue(parsed.browser.name, t('public.unknown'))
          },
          { label: t('app.format.ua.version'), value: displayValue(parsed.browser.version, '-') },
          { label: t('app.format.ua.major'), value: displayValue(parsed.browser.major, '-') },
          { label: t('app.format.ua.family'), value: analysis?.family ?? t('public.unknown') }
        ]
      },
      {
        icon: <Cpu className="h-4 w-4" />,
        title: t('app.format.ua.engine'),
        items: [
          {
            label: t('app.format.ua.name'),
            value: displayValue(parsed.engine.name, t('public.unknown'))
          },
          { label: t('app.format.ua.version'), value: displayValue(parsed.engine.version, '-') }
        ]
      },
      {
        icon: <Monitor className="h-4 w-4" />,
        title: t('app.format.ua.os'),
        items: [
          {
            label: t('app.format.ua.name'),
            value: displayValue(parsed.os.name, t('public.unknown'))
          },
          { label: t('app.format.ua.version'), value: displayValue(parsed.os.version, '-') }
        ]
      },
      {
        icon: <Smartphone className="h-4 w-4" />,
        title: t('app.format.ua.device'),
        items: [
          { label: t('app.format.ua.vendor'), value: displayValue(parsed.device.vendor, '-') },
          { label: t('app.format.ua.model'), value: displayValue(parsed.device.model, '-') },
          {
            label: t('app.format.ua.type'),
            value: getDeviceLabel(parsed.device.type, t('app.format.ua.desktop'))
          },
          {
            label: t('app.format.ua.cpu_arch'),
            value: displayValue(parsed.cpu.architecture, t('public.unknown'))
          }
        ]
      }
    ]
  }, [analysis?.family, parsed, t])

  const summaryCards = useMemo(() => {
    if (!parsed || !analysis) return []

    return [
      {
        key: 'browser',
        icon: <Globe className="h-4 w-4" />,
        label: t('app.format.ua.browser'),
        value: displayValue(parsed.browser.name, t('public.unknown')),
        meta: displayValue(parsed.browser.version, '-')
      },
      {
        key: 'os',
        icon: <Monitor className="h-4 w-4" />,
        label: t('app.format.ua.os'),
        value: displayValue(parsed.os.name, t('public.unknown')),
        meta: displayValue(parsed.os.version, '-')
      },
      {
        key: 'device',
        icon: <Smartphone className="h-4 w-4" />,
        label: t('app.format.ua.device'),
        value: getDeviceLabel(parsed.device.type, t('app.format.ua.desktop')),
        meta: displayValue(
          [parsed.device.vendor, parsed.device.model].filter(Boolean).join(' '),
          '-'
        )
      },
      {
        key: 'confidence',
        icon: <ShieldCheck className="h-4 w-4" />,
        label: t('app.format.ua.confidence'),
        value: t(analysis.confidenceKey),
        meta: `${analysis.score}/10`
      }
    ]
  }, [analysis, parsed, t])

  const signals = useMemo<Signal[]>(() => {
    if (!analysis) return []

    return [
      { key: 'desktop', labelKey: 'app.format.ua.signal.desktop', active: analysis.isDesktop },
      { key: 'mobile', labelKey: 'app.format.ua.signal.mobile', active: analysis.isMobile },
      { key: 'tablet', labelKey: 'app.format.ua.signal.tablet', active: analysis.isTablet },
      { key: 'webview', labelKey: 'app.format.ua.signal.webview', active: analysis.isWebView },
      { key: 'inapp', labelKey: 'app.format.ua.signal.inapp', active: analysis.isInApp },
      { key: 'bot', labelKey: 'app.format.ua.signal.bot', active: analysis.isBot }
    ]
  }, [analysis])

  const resultJson = useMemo(() => {
    if (!parsed || !analysis) return ''

    return JSON.stringify(
      {
        ...parsed,
        analysis: {
          engineFamily: analysis.family,
          confidenceScore: analysis.score,
          length: analysis.length,
          signals: signals.filter(signal => signal.active).map(signal => signal.key)
        }
      },
      null,
      2
    )
  }, [analysis, parsed, signals])

  const handleUseCurrent = () => {
    setInputOverride(null)
  }

  const handleSample = (sample: SampleUserAgent) => {
    setInputOverride(sample.value)
  }

  const handleClear = () => {
    setInputOverride('')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.ua.string')}
              </CardTitle>
              <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
                {t('app.format.ua.description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleUseCurrent}
              >
                {t('app.format.ua.current')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(input)}
                disabled={!trimmedInput}
              >
                {t('app.format.ua.copy_input')}
              </Button>
              <Button type="button" icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={input}
            onChange={event => setInputOverride(event.target.value)}
            placeholder={t('app.format.ua.placeholder')}
            rows={4}
            className="font-mono"
          />
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--text-tertiary)]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('app.format.ua.samples')}
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_USER_AGENTS.map(sample => (
                <Button
                  key={sample.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSample(sample)}
                >
                  {t(sample.labelKey)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!parsed && (
        <Card className="glass-panel-static">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-[var(--text-secondary)]">
            <Info className="h-5 w-5 text-[var(--primary)]" />
            {t('app.format.ua.empty')}
          </CardContent>
        </Card>
      )}

      {parsed && analysis && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(card => (
              <Card key={card.key} className="glass-prism">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]">
                    {card.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                      {card.label}
                    </div>
                    <div className="mt-1 truncate text-base font-semibold text-[var(--text-primary)]">
                      {card.value}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                      {card.meta}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.ua.signals')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {signals.map(signal => (
                  <span
                    key={signal.key}
                    className={[
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
                      signal.active
                        ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--glass-input-bg)] text-[var(--text-tertiary)]'
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'h-1.5 w-1.5 rounded-full',
                        signal.active ? 'bg-[var(--primary)]' : 'bg-[var(--text-tertiary)]'
                      ].join(' ')}
                    />
                    {t(signal.labelKey)}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <Metric label={t('app.format.ua.length')} value={String(analysis.length)} />
                <Metric label={t('app.format.ua.family')} value={analysis.family} />
                <Metric label={t('app.format.ua.confidence')} value={`${analysis.score}/10`} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections.map(section => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]">
                      {section.icon}
                    </span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    {section.items.map(item => (
                      <div key={item.label} className="contents">
                        <dt className="text-[var(--text-secondary)]">{item.label}</dt>
                        <dd
                          className="truncate font-mono text-[var(--text-primary)]"
                          title={item.value}
                        >
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.format.ua.json')}
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => copy(resultJson)}
                >
                  {t('public.copy')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="glass-input max-h-[360px] overflow-auto rounded-lg p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">
                {resultJson}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-lg p-3">
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}

export default UaClient
