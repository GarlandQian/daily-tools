'use client'

import {
  ClipboardList,
  Copy,
  Cpu,
  Download,
  FileJson,
  Globe,
  Info,
  ListChecks,
  Monitor,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Table2,
  Trash2
} from 'lucide-react'
import { type ReactNode, useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react'
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

interface UaAnalysis {
  confidenceKey: string
  family: string
  isBot: boolean
  isDesktop: boolean
  isInApp: boolean
  isMobile: boolean
  isTablet: boolean
  isWebView: boolean
  length: number
  score: number
  versionCount: number
}

interface BatchUaResult {
  browser: string
  confidence: number
  device: string
  engineFamily: string
  input: string
  os: string
  signals: string[]
  version: string
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
const MAX_UA_INPUT_CHARS = 10000
const MAX_UA_BATCH_LINES = 80
const MAX_UA_BATCH_CHARS = 60000
const MAX_UA_BATCH_PREVIEW_ROWS = 12
const uaNumberFormatter = new Intl.NumberFormat()

const formatUaNumber = (value: number) => uaNumberFormatter.format(value)

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
  const browser = browserName.toLowerCase()
  const engine = engineName.toLowerCase()
  const ua = userAgent.toLowerCase()
  if (
    browser.includes('chrome') ||
    browser.includes('chromium') ||
    browser.includes('edge') ||
    browser.includes('opera') ||
    browser.includes('samsung') ||
    engine.includes('blink')
  ) {
    return 'Chromium'
  }
  if (browser.includes('safari') || engine.includes('webkit') || ua.includes('applewebkit')) {
    return 'WebKit'
  }
  if (browser.includes('firefox') || engine.includes('gecko') || /\bgecko\//.test(ua)) {
    return 'Gecko'
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

function buildUaAnalysis(parsed: UAParser.IResult, userAgent: string): UaAnalysis {
  const browserName = parsed.browser.name || ''
  const engineName = parsed.engine.name || ''
  const deviceType = parsed.device.type
  const family = getEngineFamily(browserName, engineName, userAgent)
  const score = getConfidenceScore(parsed)
  const confidenceKey =
    score >= 7
      ? 'app.format.ua.confidence.high'
      : score >= 4
        ? 'app.format.ua.confidence.medium'
        : 'app.format.ua.confidence.low'
  const browserType = parsed.browser.type?.toLowerCase()
  const isBot = BOT_PATTERN.test(userAgent) || browserType === 'crawler'
  const isWebView = WEBVIEW_PATTERN.test(userAgent) || browserName.toLowerCase().includes('webview')
  const isInApp = IN_APP_PATTERN.test(userAgent) || browserType === 'inapp'
  const isMobile = deviceType === 'mobile'
  const isTablet = deviceType === 'tablet'

  return {
    confidenceKey,
    family,
    isBot,
    isDesktop: !deviceType,
    isInApp,
    isMobile,
    isTablet,
    isWebView,
    length: userAgent.length,
    score,
    versionCount: (userAgent.match(/\d+(?:[._-]\d+)+/g) ?? []).length
  }
}

function getActiveSignalKeys(analysis: UaAnalysis) {
  return [
    analysis.isDesktop ? 'desktop' : '',
    analysis.isMobile ? 'mobile' : '',
    analysis.isTablet ? 'tablet' : '',
    analysis.isWebView ? 'webview' : '',
    analysis.isInApp ? 'inapp' : '',
    analysis.isBot ? 'bot' : ''
  ].filter(Boolean)
}

const csvEscape = (value: string | number | string[]) => {
  const text = Array.isArray(value) ? value.join('|') : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildBatchRows = (input: string): BatchUaResult[] =>
  input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, MAX_UA_BATCH_LINES)
    .map(line => {
      const safeLine = line.length > MAX_UA_INPUT_CHARS ? line.slice(0, MAX_UA_INPUT_CHARS) : line
      const parsed = new UAParser(safeLine, UA_EXTENSIONS).getResult()
      const analysis = buildUaAnalysis(parsed, safeLine)

      return {
        browser: displayValue(parsed.browser.name, 'Unknown'),
        confidence: analysis.score,
        device: parsed.device.type || 'desktop',
        engineFamily: analysis.family,
        input: safeLine,
        os: displayValue(parsed.os.name, 'Unknown'),
        signals: getActiveSignalKeys(analysis),
        version: displayValue(parsed.browser.version, '-')
      }
    })

const buildBatchCsv = (rows: BatchUaResult[]) =>
  [
    'input,browser,version,os,device,engineFamily,confidence,signals',
    ...rows.map(row =>
      [
        row.input,
        row.browser,
        row.version,
        row.os,
        row.device,
        row.engineFamily,
        row.confidence,
        row.signals
      ]
        .map(csvEscape)
        .join(',')
    )
  ].join('\n')

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
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
  const [batchInput, setBatchInput] = useState('')
  const input = inputOverride ?? userAgent
  const trimmedInput = input.trim()
  const deferredTrimmedInput = useDeferredValue(trimmedInput)
  const deferredBatchInput = useDeferredValue(batchInput)
  const isInputTruncated = deferredTrimmedInput.length > MAX_UA_INPUT_CHARS
  const isBatchInputTruncated = deferredBatchInput.length > MAX_UA_BATCH_CHARS
  const safeTrimmedInput = useMemo(
    () =>
      deferredTrimmedInput.length > MAX_UA_INPUT_CHARS
        ? deferredTrimmedInput.slice(0, MAX_UA_INPUT_CHARS)
        : deferredTrimmedInput,
    [deferredTrimmedInput]
  )
  const safeBatchInput = useMemo(
    () =>
      deferredBatchInput.length > MAX_UA_BATCH_CHARS
        ? deferredBatchInput.slice(0, MAX_UA_BATCH_CHARS)
        : deferredBatchInput,
    [deferredBatchInput]
  )
  const batchLineCount = useMemo(
    () =>
      safeBatchInput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean).length,
    [safeBatchInput]
  )
  const isBatchLineLimited = batchLineCount > MAX_UA_BATCH_LINES

  const parsed = useMemo(() => {
    if (!safeTrimmedInput) return null
    return new UAParser(safeTrimmedInput, UA_EXTENSIONS).getResult()
  }, [safeTrimmedInput])

  const analysis = useMemo(() => {
    if (!parsed) return null

    return buildUaAnalysis(parsed, safeTrimmedInput)
  }, [safeTrimmedInput, parsed])

  const batchRows = useMemo(() => buildBatchRows(safeBatchInput), [safeBatchInput])
  const batchCsv = useMemo(() => buildBatchCsv(batchRows), [batchRows])
  const batchStats = useMemo(() => {
    const browserSet = new Set<string>()
    const osSet = new Set<string>()
    let bots = 0
    let mobile = 0
    let webviews = 0
    let inApps = 0

    batchRows.forEach(row => {
      if (row.browser !== 'Unknown') browserSet.add(row.browser)
      if (row.os !== 'Unknown') osSet.add(row.os)
      if (row.signals.includes('bot')) bots += 1
      if (row.signals.includes('mobile') || row.signals.includes('tablet')) mobile += 1
      if (row.signals.includes('webview')) webviews += 1
      if (row.signals.includes('inapp')) inApps += 1
    })

    return {
      bots,
      browsers: browserSet.size,
      inApps,
      mobile,
      os: osSet.size,
      total: batchRows.length,
      webviews
    }
  }, [batchRows])

  const batchJson = useMemo(
    () =>
      JSON.stringify(
        {
          rows: batchRows,
          stats: batchStats
        },
        null,
        2
      ),
    [batchRows, batchStats]
  )

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

  const diagnostics = useMemo(() => {
    if (!parsed || !analysis) return []

    return [
      {
        active: analysis.isBot,
        key: 'bot',
        labelKey: 'app.format.ua.diagnostic.bot'
      },
      {
        active: analysis.isWebView || analysis.isInApp,
        key: 'embedded',
        labelKey: 'app.format.ua.diagnostic.embedded'
      },
      {
        active: analysis.score <= 3,
        key: 'low-confidence',
        labelKey: 'app.format.ua.diagnostic.low_confidence'
      },
      {
        active: !parsed.browser.version,
        key: 'missing-version',
        labelKey: 'app.format.ua.diagnostic.missing_version'
      },
      {
        active: analysis.length > 512,
        key: 'long',
        labelKey: 'app.format.ua.diagnostic.long'
      }
    ].filter(item => item.active)
  }, [analysis, parsed])

  const resultJson = useMemo(() => {
    if (!parsed || !analysis) return ''

    return JSON.stringify(
      {
        ...parsed,
        analysis: {
          engineFamily: analysis.family,
          confidenceScore: analysis.score,
          length: analysis.length,
          signals: getActiveSignalKeys(analysis),
          versionCount: analysis.versionCount
        }
      },
      null,
      2
    )
  }, [analysis, parsed])

  const handleUseCurrent = () => {
    setInputOverride(null)
  }

  const handleSample = (sample: SampleUserAgent) => {
    setInputOverride(sample.value)
  }

  const handleClear = () => {
    setInputOverride('')
    setBatchInput('')
  }

  const handleBatchSample = () => {
    setBatchInput(SAMPLE_USER_AGENTS.map(sample => sample.value).join('\n'))
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
          {isInputTruncated && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.ua.warning.truncated', {
                limit: formatUaNumber(MAX_UA_INPUT_CHARS)
              })}
            </p>
          )}
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
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                <Metric label={t('app.format.ua.length')} value={formatUaNumber(analysis.length)} />
                <Metric label={t('app.format.ua.family')} value={analysis.family} />
                <Metric label={t('app.format.ua.confidence')} value={`${analysis.score}/10`} />
                <Metric
                  label={t('app.format.ua.version_count')}
                  value={formatUaNumber(analysis.versionCount)}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                  {t('app.format.ua.diagnostics')}
                </div>
                {diagnostics.length ? (
                  <div className="flex flex-wrap gap-2">
                    {diagnostics.map(item => (
                      <span
                        key={item.key}
                        className="inline-flex rounded-full border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-1.5 text-sm text-[var(--warning)]"
                      >
                        {t(item.labelKey)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('app.format.ua.diagnostic.clean')}
                  </p>
                )}
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={() => copy(resultJson)}
                  >
                    {t('public.copy')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-4 w-4" />}
                    onClick={() =>
                      downloadText(
                        resultJson,
                        'daily-tools-user-agent.json',
                        'application/json;charset=utf-8'
                      )
                    }
                  >
                    {t('app.format.ua.download_json')}
                  </Button>
                </div>
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.ua.batch')}
              </CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('app.format.ua.batch_description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={handleBatchSample}
              >
                {t('app.format.ua.batch_sample')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<FileJson className="h-4 w-4" />}
                onClick={() => copy(batchJson)}
                disabled={!batchRows.length}
              >
                JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Table2 className="h-4 w-4" />}
                onClick={() => copy(batchCsv)}
                disabled={!batchRows.length}
              >
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    batchJson,
                    'daily-tools-user-agents.json',
                    'application/json;charset=utf-8'
                  )
                }
                disabled={!batchRows.length}
              >
                {t('app.format.ua.download_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setBatchInput('')}
                disabled={!batchInput}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={batchInput}
            onChange={event => setBatchInput(event.target.value)}
            placeholder={t('app.format.ua.batch_placeholder')}
            rows={5}
            className="font-mono"
          />
          {(isBatchInputTruncated || isBatchLineLimited) && (
            <div className="space-y-2">
              {isBatchInputTruncated && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.format.ua.batch_warning.truncated', {
                    limit: formatUaNumber(MAX_UA_BATCH_CHARS)
                  })}
                </p>
              )}
              {isBatchLineLimited && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.format.ua.batch_warning.lines', {
                    limit: formatUaNumber(MAX_UA_BATCH_LINES)
                  })}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Metric
              label={t('app.format.ua.batch_total')}
              value={formatUaNumber(batchStats.total)}
            />
            <Metric
              label={t('app.format.ua.batch_browsers')}
              value={formatUaNumber(batchStats.browsers)}
            />
            <Metric label={t('app.format.ua.batch_os')} value={formatUaNumber(batchStats.os)} />
            <Metric
              label={t('app.format.ua.batch_mobile')}
              value={formatUaNumber(batchStats.mobile)}
            />
            <Metric label={t('app.format.ua.batch_bots')} value={formatUaNumber(batchStats.bots)} />
            <Metric
              label={t('app.format.ua.batch_webviews')}
              value={formatUaNumber(batchStats.webviews)}
            />
            <Metric
              label={t('app.format.ua.batch_inapps')}
              value={formatUaNumber(batchStats.inApps)}
            />
          </div>

          {batchRows.length ? (
            <div className="space-y-3">
              {batchRows.slice(0, MAX_UA_BATCH_PREVIEW_ROWS).map((row, index) => (
                <div
                  key={`${row.input}-${index}`}
                  className="glass-input grid min-w-0 gap-3 rounded-lg p-3 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {t('app.format.ua.batch_user_agent')}
                    </div>
                    <div className="mt-1 truncate font-mono text-[var(--text-primary)]">
                      {row.input}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {t('app.format.ua.browser')}
                    </div>
                    <div className="mt-1 truncate font-medium text-[var(--text-primary)]">
                      {row.browser === 'Unknown' ? t('public.unknown') : row.browser}
                    </div>
                    <div className="truncate font-mono text-xs text-[var(--text-secondary)]">
                      {row.version}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {t('app.format.ua.os')}
                    </div>
                    <div className="mt-1 truncate text-[var(--text-primary)]">
                      {row.os === 'Unknown' ? t('public.unknown') : row.os}
                    </div>
                    <div className="truncate font-mono text-xs text-[var(--text-secondary)]">
                      {row.device} · {row.engineFamily}
                    </div>
                  </div>
                  <div className="min-w-0 lg:text-right">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {t('app.format.ua.confidence')}
                    </div>
                    <div className="mt-1 font-mono font-semibold text-[var(--text-primary)]">
                      {row.confidence}/10
                    </div>
                    <div className="max-w-full truncate text-xs text-[var(--text-secondary)]">
                      {row.signals.length
                        ? row.signals.map(signal => t(`app.format.ua.signal.${signal}`)).join(' · ')
                        : '-'}
                    </div>
                  </div>
                </div>
              ))}
              {batchRows.length > MAX_UA_BATCH_PREVIEW_ROWS && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('app.format.ua.batch_preview_more', {
                    count: batchRows.length - MAX_UA_BATCH_PREVIEW_ROWS
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="glass-panel-static rounded-lg p-4 text-sm text-[var(--text-secondary)]">
              {t('app.format.ua.batch_empty')}
            </div>
          )}
        </CardContent>
      </Card>
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
