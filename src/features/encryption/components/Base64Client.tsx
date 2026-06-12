'use client'

import {
  Binary,
  Copy,
  Download,
  FlaskConical,
  Lock,
  ShieldCheck,
  Trash2,
  Unlock
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

type Mode = 'encode' | 'decode'

const MAX_BASE64_INPUT_CHARS = 120000
const MAX_BASE64_LIVE_ENCODE_CHARS = 30000
const MAX_BASE64_LIVE_DECODE_CHARS = 60000

const BASE64_SAMPLE = `{
  "tool": "Daily Tools",
  "mode": "local-first",
  "safe": true
}`

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

const toBase64 = (value: string) => {
  const bytes = encoder.encode(value)
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return decoder.decode(bytes)
}

const toUrlSafe = (value: string, omitPadding: boolean) => {
  const nextValue = value.replaceAll('+', '-').replaceAll('/', '_')
  return omitPadding ? nextValue.replace(/=+$/u, '') : nextValue
}

const fromUrlSafe = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = normalized.length % 4
  return padding ? `${normalized}${'='.repeat(4 - padding)}` : normalized
}

const normalizeBase64Input = (value: string, urlSafe: boolean) => {
  const compact = value.replace(/\s+/g, '')
  return urlSafe ? fromUrlSafe(compact) : compact
}

const validateBase64Input = (value: string, urlSafe: boolean) => {
  const compact = value.replace(/\s+/g, '')
  if (!compact) return null

  const pattern = urlSafe ? /^[A-Za-z0-9_-]*={0,2}$/u : /^[A-Za-z0-9+/]*={0,2}$/u
  if (!pattern.test(compact)) return 'invalid_chars'
  if (/=.+[A-Za-z0-9+/_-]/u.test(compact)) return 'padding_position'

  const normalized = urlSafe ? fromUrlSafe(compact) : compact
  if (normalized.length % 4 !== 0) return 'length'
  return null
}

const getLiveBase64Input = (value: string, mode: Mode) => {
  if (mode === 'encode') return value.slice(0, MAX_BASE64_LIVE_ENCODE_CHARS)

  const compact = value.replace(/\s+/g, '').slice(0, MAX_BASE64_LIVE_DECODE_CHARS)
  return compact.slice(0, compact.length - (compact.length % 4))
}

const isBase64LiveDeferred = (value: string, mode: Mode) =>
  mode === 'encode'
    ? value.length > MAX_BASE64_LIVE_ENCODE_CHARS
    : value.replace(/\s+/g, '').length > MAX_BASE64_LIVE_DECODE_CHARS

const convertBase64 = (
  value: string,
  mode: Mode,
  urlSafe: boolean,
  omitPadding: boolean,
  strictDecode: boolean
) => {
  try {
    if (mode === 'encode') {
      const encoded = toBase64(value)
      return {
        errorKey: null as string | null,
        output: urlSafe ? toUrlSafe(encoded, omitPadding) : encoded,
        success: true
      }
    }

    const validationError = validateBase64Input(value, urlSafe)
    if (strictDecode && validationError) {
      return {
        errorKey: `app.encryption.base64.error.${validationError}`,
        output: '',
        success: false
      }
    }

    return {
      errorKey: null,
      output: fromBase64(normalizeBase64Input(value, urlSafe)),
      success: true
    }
  } catch {
    return {
      errorKey: 'app.encryption.base64.error.decode_failed',
      output: '',
      success: false
    }
  }
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
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

export default function Base64Client() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()

  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('encode')
  const [urlSafe, setUrlSafe] = useState(false)
  const [omitPadding, setOmitPadding] = useState(false)
  const [strictDecode, setStrictDecode] = useState(true)
  const [isInputCapped, setIsInputCapped] = useState(false)
  const deferredText = useDeferredValue(text)
  const deferredMode = useDeferredValue(mode)
  const deferredUrlSafe = useDeferredValue(urlSafe)
  const deferredOmitPadding = useDeferredValue(omitPadding)
  const deferredStrictDecode = useDeferredValue(strictDecode)

  const safeInput = useMemo(() => deferredText.slice(0, MAX_BASE64_INPUT_CHARS), [deferredText])
  const liveConversionDeferred = isBase64LiveDeferred(safeInput, deferredMode)
  const liveInput = useMemo(
    () => getLiveBase64Input(safeInput, deferredMode),
    [deferredMode, safeInput]
  )
  const conversion = useMemo(() => {
    if (!liveInput) {
      return {
        error: null as string | null,
        errorKey: null as string | null,
        output: '',
        success: true
      }
    }

    const result = convertBase64(
      liveInput,
      deferredMode,
      deferredUrlSafe,
      deferredOmitPadding,
      deferredStrictDecode
    )

    return {
      error: result.errorKey ? t(result.errorKey) : null,
      errorKey: result.errorKey,
      output: result.output,
      success: result.success
    }
  }, [deferredMode, deferredOmitPadding, deferredStrictDecode, deferredUrlSafe, liveInput, t])
  const outputPreview = useMemo(() => createOutputPreview(conversion.output), [conversion.output])
  const outputPreviewLimited = isOutputPreviewLimited(conversion.output)

  const stats = useMemo(() => {
    const inputBytes = encoder.encode(safeInput).length
    const outputBytes = encoder.encode(conversion.output).length
    const ratio = inputBytes > 0 ? Math.round((outputBytes / inputBytes) * 100) : 0

    return [
      { label: t('app.encryption.base64.stats.input_chars'), value: safeInput.length },
      { label: t('app.encryption.base64.stats.input_bytes'), value: formatBytes(inputBytes) },
      {
        label: t('app.encryption.base64.stats.output_chars'),
        value: liveConversionDeferred ? `${conversion.output.length}+` : conversion.output.length
      },
      { label: t('app.encryption.base64.stats.ratio'), value: `${ratio}%` }
    ]
  }, [conversion.output, liveConversionDeferred, safeInput, t])

  const warnings = useMemo(() => {
    const messages: string[] = []
    if (isInputCapped || deferredText.length > MAX_BASE64_INPUT_CHARS) {
      messages.push(t('app.encryption.base64.warning.truncated', { count: MAX_BASE64_INPUT_CHARS }))
    }
    if (liveConversionDeferred) {
      messages.push(
        t('app.encryption.base64.warning.live_output_deferred', {
          total: safeInput.length.toLocaleString(),
          visible: liveInput.length.toLocaleString()
        })
      )
    }
    return messages
  }, [
    deferredText.length,
    isInputCapped,
    liveConversionDeferred,
    liveInput.length,
    safeInput.length,
    t
  ])

  const updateText = useCallback((value: string) => {
    const isCapped = value.length > MAX_BASE64_INPUT_CHARS
    setIsInputCapped(isCapped)
    setText(isCapped ? value.slice(0, MAX_BASE64_INPUT_CHARS) : value)
  }, [])

  const loadSample = useCallback(() => {
    setMode('encode')
    setUrlSafe(false)
    setOmitPadding(false)
    setStrictDecode(true)
    setIsInputCapped(false)
    setText(BASE64_SAMPLE)
  }, [])

  const buildCurrentOutput = useCallback(
    () => convertBase64(safeInput, mode, urlSafe, omitPadding, strictDecode),
    [mode, omitPadding, safeInput, strictDecode, urlSafe]
  )

  const handleUseOutput = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    updateText(result.output)
    setMode(current => (current === 'encode' ? 'decode' : 'encode'))
  }

  const handleCopyOutput = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    void copy(result.output)
  }

  const handleDownload = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    downloadText(result.output, 'daily-tools-base64.txt', 'text/plain;charset=utf-8')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Binary className="h-5 w-5 text-[var(--primary)]" />
              {t('app.encryption.base64')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={loadSample}
              >
                {t('app.encryption.base64.sample')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => updateText('')}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label>{t('app.encryption.base64.mode')}</Label>
              <RadioGroup
                value={mode}
                onValueChange={value => setMode(value as Mode)}
                className="grid grid-cols-2 gap-2"
              >
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="encode" id="base64-encode" />
                  <Lock className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium">{t('app.encryption.base64.encode')}</span>
                </label>
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="decode" id="base64-decode" />
                  <Unlock className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium">{t('app.encryption.base64.decode')}</span>
                </label>
              </RadioGroup>
            </div>

            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={urlSafe}
                onChange={event => setUrlSafe(event.target.checked)}
                label={t('app.encryption.base64.url_safe')}
              />
              <Checkbox
                checked={omitPadding}
                onChange={event => setOmitPadding(event.target.checked)}
                disabled={!urlSafe || mode === 'decode'}
                label={t('app.encryption.base64.omit_padding')}
              />
              <Checkbox
                checked={strictDecode}
                onChange={event => setStrictDecode(event.target.checked)}
                disabled={mode === 'encode'}
                label={t('app.encryption.base64.strict')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="base64-content">{t('app.encryption.base64.input')}</Label>
              <Textarea
                id="base64-content"
                rows={10}
                value={text}
                onChange={event => updateText(event.target.value)}
                placeholder={
                  mode === 'encode'
                    ? t('app.encryption.base64.encode_placeholder')
                    : t('app.encryption.base64.decode_placeholder')
                }
                className="resize-none font-mono"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="base64-output">{t('app.encryption.base64.output')}</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleUseOutput}
                  >
                    {t('app.encryption.base64.use_output')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Download className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleDownload}
                  >
                    {t('app.encryption.base64.download')}
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
                id="base64-output"
                value={outputPreview}
                readOnly
                rows={10}
                placeholder={t('app.encryption.base64.output_placeholder')}
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

          {warnings.map(message => (
            <p
              key={message}
              className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]"
            >
              {message}
            </p>
          ))}

          {conversion.error && (
            <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
              {conversion.error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
