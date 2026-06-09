'use client'

import { Binary, Copy, FlaskConical, Lock, ShieldCheck, Trash2, Unlock } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type Mode = 'encode' | 'decode'

const MAX_BASE64_INPUT_CHARS = 120000

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

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function Base64Client() {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('encode')
  const [urlSafe, setUrlSafe] = useState(false)
  const [omitPadding, setOmitPadding] = useState(false)
  const [strictDecode, setStrictDecode] = useState(true)
  const deferredText = useDeferredValue(text)
  const deferredMode = useDeferredValue(mode)
  const deferredUrlSafe = useDeferredValue(urlSafe)
  const deferredOmitPadding = useDeferredValue(omitPadding)
  const deferredStrictDecode = useDeferredValue(strictDecode)

  const safeInput = useMemo(() => deferredText.slice(0, MAX_BASE64_INPUT_CHARS), [deferredText])
  const conversion = useMemo(() => {
    if (!safeInput) {
      return { error: null as string | null, output: '', success: true }
    }

    try {
      if (deferredMode === 'encode') {
        const encoded = toBase64(safeInput)
        return {
          error: null,
          output: deferredUrlSafe ? toUrlSafe(encoded, deferredOmitPadding) : encoded,
          success: true
        }
      }

      const validationError = validateBase64Input(safeInput, deferredUrlSafe)
      if (deferredStrictDecode && validationError) {
        return {
          error: t(`app.encryption.base64.error.${validationError}`),
          output: '',
          success: false
        }
      }

      return {
        error: null,
        output: fromBase64(normalizeBase64Input(safeInput, deferredUrlSafe)),
        success: true
      }
    } catch {
      return {
        error: t('app.encryption.base64.error.decode_failed'),
        output: '',
        success: false
      }
    }
  }, [deferredMode, deferredOmitPadding, deferredStrictDecode, deferredUrlSafe, safeInput, t])

  const stats = useMemo(() => {
    const inputBytes = encoder.encode(safeInput).length
    const outputBytes = encoder.encode(conversion.output).length
    const ratio = inputBytes > 0 ? Math.round((outputBytes / inputBytes) * 100) : 0

    return [
      { label: t('app.encryption.base64.stats.input_chars'), value: safeInput.length },
      { label: t('app.encryption.base64.stats.input_bytes'), value: formatBytes(inputBytes) },
      { label: t('app.encryption.base64.stats.output_chars'), value: conversion.output.length },
      { label: t('app.encryption.base64.stats.ratio'), value: `${ratio}%` }
    ]
  }, [conversion.output, safeInput, t])

  const warning =
    deferredText.length > MAX_BASE64_INPUT_CHARS
      ? t('app.encryption.base64.warning.truncated', { count: MAX_BASE64_INPUT_CHARS })
      : null

  const loadSample = useCallback(() => {
    setMode('encode')
    setUrlSafe(false)
    setOmitPadding(false)
    setStrictDecode(true)
    setText(BASE64_SAMPLE)
  }, [])

  const handleUseOutput = () => {
    setText(conversion.output)
    setMode(current => (current === 'encode' ? 'decode' : 'encode'))
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
                onClick={() => setText('')}
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
                onChange={event => setText(event.target.value)}
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
                    disabled={!conversion.success || !conversion.output}
                    onClick={handleUseOutput}
                  >
                    {t('app.encryption.base64.use_output')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    disabled={!conversion.success || !conversion.output}
                    onClick={() => copy(conversion.output)}
                  >
                    {t('public.copy')}
                  </Button>
                </div>
              </div>
              <Textarea
                id="base64-output"
                value={conversion.output}
                readOnly
                rows={10}
                placeholder={t('app.encryption.base64.output_placeholder')}
                className="resize-none font-mono"
              />
            </div>
          </div>

          {warning && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}

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
