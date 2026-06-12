'use client'

import he from 'he'
import {
  ArrowRightLeft,
  Code2,
  Copy,
  Download,
  FlaskConical,
  ShieldAlert,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

type EntityStyle = 'named' | 'decimal' | 'hex'
type Mode = 'encode' | 'decode'

const MAX_HTML_INPUT_CHARS = 120000
const MAX_HTML_LIVE_CONVERSION_CHARS = 30000

const HTML_SAMPLE = `<section data-note="Tom & Jerry">
  <h1>Daily Tools \\u00A9 2026</h1>
  <p>Encode <, >, &, "quotes", and 'apostrophes'.</p>
</section>`

const entityLegend = [
  { char: '<', entity: '&lt;' },
  { char: '>', entity: '&gt;' },
  { char: '&', entity: '&amp;' },
  { char: '"', entity: '&quot;' },
  { char: "'", entity: '&#x27;' }
]

const unsafeEntityMap: Record<EntityStyle, Record<string, string>> = {
  named: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
    '`': '&#x60;'
  },
  decimal: {
    '&': '&#38;',
    '<': '&#60;',
    '>': '&#62;',
    '"': '&#34;',
    "'": '&#39;',
    '`': '&#96;'
  },
  hex: {
    '&': '&#x26;',
    '<': '&#x3C;',
    '>': '&#x3E;',
    '"': '&#x22;',
    "'": '&#x27;',
    '`': '&#x60;'
  }
}

const htmlEncodeOptions: Record<EntityStyle, he.EncodeOptions> = {
  named: { useNamedReferences: true },
  decimal: { decimal: true },
  hex: {}
}

const countEntities = (value: string) =>
  value.match(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/giu)?.length ?? 0

const hasSuspiciousAmpersand = (value: string) =>
  /&(?:#x?[0-9a-f]+|[A-Za-z][A-Za-z0-9]{1,31})(?![A-Za-z0-9]*;)/u.test(value)

const hasInvalidNumericEntity = (value: string) => {
  for (const match of value.matchAll(/&#(?:x([0-9a-f]+)|(\d+));/giu)) {
    const codePoint = Number.parseInt(match[1] ?? match[2] ?? '', match[1] ? 16 : 10)
    if (
      !Number.isFinite(codePoint) ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return true
    }
  }
  return false
}

const escapeUnsafeOnly = (value: string, entityStyle: EntityStyle) =>
  value.replace(/[&<>"'`]/gu, char => unsafeEntityMap[entityStyle][char] ?? char)

const getLiveHtmlInput = (value: string, mode: Mode) => {
  const preview = value.slice(0, MAX_HTML_LIVE_CONVERSION_CHARS)
  if (mode !== 'decode' || preview.length === value.length) return preview

  const lastAmpersand = preview.lastIndexOf('&')
  const lastSemicolon = preview.lastIndexOf(';')
  if (lastAmpersand > lastSemicolon && preview.length - lastAmpersand < 40) {
    return preview.slice(0, lastAmpersand)
  }

  return preview
}

const convertHtml = (
  value: string,
  mode: Mode,
  entityStyle: EntityStyle,
  encodeNonAscii: boolean,
  strictDecode: boolean
) => {
  try {
    if (mode === 'encode') {
      const output = encodeNonAscii
        ? he.encode(value, htmlEncodeOptions[entityStyle])
        : escapeUnsafeOnly(value, entityStyle)

      return { errorKey: null as string | null, output, success: true }
    }

    return {
      errorKey: null,
      output: he.decode(value, { strict: strictDecode }),
      success: true
    }
  } catch {
    return {
      errorKey: 'app.converter.html.warning.decode_failed',
      output: '',
      success: false
    }
  }
}

const formatRatio = (inputLength: number, outputLength: number) => {
  if (inputLength === 0) return '0%'
  return `${Math.round((outputLength / inputLength) * 100)}%`
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function HtmlClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('encode')
  const [entityStyle, setEntityStyle] = useState<EntityStyle>('named')
  const [encodeNonAscii, setEncodeNonAscii] = useState(true)
  const [strictDecode, setStrictDecode] = useState(true)
  const [isInputCapped, setIsInputCapped] = useState(false)

  const deferredInput = useDeferredValue(input)
  const deferredMode = useDeferredValue(mode)
  const deferredEntityStyle = useDeferredValue(entityStyle)
  const deferredEncodeNonAscii = useDeferredValue(encodeNonAscii)
  const deferredStrictDecode = useDeferredValue(strictDecode)

  const safeInput = useMemo(() => deferredInput.slice(0, MAX_HTML_INPUT_CHARS), [deferredInput])
  const liveConversionDeferred = safeInput.length > MAX_HTML_LIVE_CONVERSION_CHARS
  const liveInput = useMemo(
    () => getLiveHtmlInput(safeInput, deferredMode),
    [deferredMode, safeInput]
  )

  const conversion = useMemo(() => {
    if (!liveInput) {
      return {
        errorKey: null as string | null,
        error: null as string | null,
        output: '',
        success: true
      }
    }

    const result = convertHtml(
      liveInput,
      deferredMode,
      deferredEntityStyle,
      deferredEncodeNonAscii,
      deferredStrictDecode
    )

    return {
      error: result.errorKey ? t(result.errorKey) : null,
      errorKey: result.errorKey,
      output: result.output,
      success: result.success
    }
  }, [
    deferredEncodeNonAscii,
    deferredEntityStyle,
    deferredMode,
    deferredStrictDecode,
    liveInput,
    t
  ])
  const outputPreview = useMemo(() => createOutputPreview(conversion.output), [conversion.output])
  const outputPreviewLimited = isOutputPreviewLimited(conversion.output)

  const entityCount = useMemo(
    () => countEntities(deferredMode === 'decode' ? safeInput : conversion.output),
    [conversion.output, deferredMode, safeInput]
  )

  const stats = useMemo(
    () => [
      { label: t('app.converter.html.stats.input_chars'), value: safeInput.length },
      {
        label: t('app.converter.html.stats.output_chars'),
        value: liveConversionDeferred ? `${conversion.output.length}+` : conversion.output.length
      },
      { label: t('app.converter.html.stats.entities'), value: entityCount },
      {
        label: t('app.converter.html.stats.ratio'),
        value: formatRatio(safeInput.length, conversion.output.length)
      }
    ],
    [conversion.output.length, entityCount, liveConversionDeferred, safeInput.length, t]
  )

  const warnings = useMemo(() => {
    const messages: string[] = []

    if (isInputCapped || deferredInput.length > MAX_HTML_INPUT_CHARS) {
      messages.push(t('app.converter.html.warning.truncated', { count: MAX_HTML_INPUT_CHARS }))
    }

    if (liveConversionDeferred) {
      messages.push(
        t('app.converter.html.warning.live_output_deferred', {
          total: safeInput.length.toLocaleString(),
          visible: liveInput.length.toLocaleString()
        })
      )
    }

    if (deferredMode === 'decode' && safeInput.trim()) {
      if (deferredStrictDecode && entityCount === 0) {
        messages.push(t('app.converter.html.warning.no_entities'))
      }
      if (hasSuspiciousAmpersand(safeInput)) {
        messages.push(t('app.converter.html.warning.suspicious_amp'))
      }
      if (hasInvalidNumericEntity(safeInput)) {
        messages.push(t('app.converter.html.warning.invalid_numeric'))
      }
    }

    return messages
  }, [
    deferredInput.length,
    deferredMode,
    deferredStrictDecode,
    entityCount,
    isInputCapped,
    liveConversionDeferred,
    liveInput.length,
    safeInput,
    t
  ])

  const updateInput = useCallback((value: string) => {
    const isCapped = value.length > MAX_HTML_INPUT_CHARS
    setIsInputCapped(isCapped)
    setInput(isCapped ? value.slice(0, MAX_HTML_INPUT_CHARS) : value)
  }, [])

  const loadSample = useCallback(() => {
    setMode('encode')
    setEntityStyle('named')
    setEncodeNonAscii(true)
    setStrictDecode(true)
    setIsInputCapped(false)
    setInput(HTML_SAMPLE.replace('\\u00A9', '\u00A9'))
  }, [])

  const buildCurrentOutput = useCallback(() => {
    return convertHtml(safeInput, mode, entityStyle, encodeNonAscii, strictDecode)
  }, [encodeNonAscii, entityStyle, mode, safeInput, strictDecode])

  const handleOutputError = useCallback(
    (errorKey: string | null) => {
      if (errorKey) toast.error(t(errorKey))
    },
    [t, toast]
  )

  const handleSwap = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      handleOutputError(result.errorKey)
      return
    }
    updateInput(result.output)
    setMode(current => (current === 'encode' ? 'decode' : 'encode'))
  }

  const handleCopyOutput = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      handleOutputError(result.errorKey)
      return
    }
    void copy(result.output)
  }

  const handleDownload = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      handleOutputError(result.errorKey)
      return
    }
    downloadText(result.output, 'daily-tools-html.txt', 'text/plain;charset=utf-8')
  }

  const handleClear = () => {
    updateInput('')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.html')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.converter.html.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={loadSample}
              >
                {t('app.converter.html.sample')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleClear}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(item => (
              <div key={item.label} className="glass-input rounded-xl p-3">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Label>{t('app.converter.html.mode')}</Label>
              <RadioGroup
                value={mode}
                onValueChange={value => setMode(value as Mode)}
                className="grid grid-cols-2 gap-2"
              >
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="encode" id="html-encode" />
                  <span className="text-sm font-medium">{t('app.converter.html.encode')}</span>
                </label>
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="decode" id="html-decode" />
                  <span className="text-sm font-medium">{t('app.converter.html.decode')}</span>
                </label>
              </RadioGroup>
            </div>

            <div className="glass-input space-y-3 rounded-xl p-3">
              <div className="space-y-2">
                <Label htmlFor="html-entity-style">{t('app.converter.html.entity_style')}</Label>
                <Select
                  id="html-entity-style"
                  value={entityStyle}
                  onChange={event => setEntityStyle(event.target.value as EntityStyle)}
                  disabled={mode === 'decode'}
                >
                  <option value="named">{t('app.converter.html.entity_style.named')}</option>
                  <option value="decimal">{t('app.converter.html.entity_style.decimal')}</option>
                  <option value="hex">{t('app.converter.html.entity_style.hex')}</option>
                </Select>
              </div>
              <Checkbox
                checked={encodeNonAscii}
                onChange={event => setEncodeNonAscii(event.target.checked)}
                disabled={mode === 'decode'}
                label={t('app.converter.html.encode_non_ascii')}
              />
              <Checkbox
                checked={strictDecode}
                onChange={event => setStrictDecode(event.target.checked)}
                disabled={mode === 'encode'}
                label={t('app.converter.html.strict_decode')}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-1">
            {entityLegend.map(({ char, entity }) => (
              <span
                key={char}
                className="glass-panel inline-flex items-center gap-1.5 rounded-full border border-[var(--border-base)] px-2.5 py-1 font-mono text-xs"
              >
                <span className="font-semibold text-[var(--text-primary)]">{char}</span>
                <span className="text-[var(--text-tertiary)]">-&gt;</span>
                <span className="text-[var(--primary)]">{entity}</span>
              </span>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="html-input">{t('app.converter.html.input')}</Label>
              <Textarea
                id="html-input"
                value={input}
                onChange={event => updateInput(event.target.value)}
                placeholder={
                  mode === 'encode'
                    ? t('app.converter.html.encode_placeholder')
                    : t('app.converter.html.decode_placeholder')
                }
                rows={12}
                className="resize-none font-mono"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="html-output">{t('app.converter.html.output')}</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<ArrowRightLeft className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleSwap}
                  >
                    {t('app.converter.html.use_output')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Download className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleDownload}
                  >
                    {t('app.converter.html.download')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleCopyOutput}
                  >
                    {t('public.copy')}
                  </Button>
                </div>
              </div>
              <Textarea
                id="html-output"
                value={outputPreview}
                readOnly
                rows={12}
                placeholder={t('app.converter.html.result_placeholder')}
                className="resize-none font-mono"
              />
              {outputPreviewLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_action_limited', {
                    total: conversion.output.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
            </div>
          </div>

          {(conversion.error || warnings.length > 0) && (
            <div className="space-y-2">
              {conversion.error && (
                <p className="flex items-center gap-2 rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {conversion.error}
                </p>
              )}
              {warnings.map(message => (
                <p
                  key={message}
                  className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]"
                >
                  {message}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
