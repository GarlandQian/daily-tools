'use client'

import { Copy, FileDown, FileJson, KeyRound, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type TokenFormat = 'alphanumeric' | 'base64' | 'base64url' | 'hex' | 'numeric'
type TokenOutput = 'bearer' | 'curl' | 'env' | 'json' | 'lines'

interface TokenFormData {
  count: number
  expiresDays: number
  format: TokenFormat
  includeBearer: boolean
  length: number
  prefix: string
}

interface TokenPreset {
  key: string
  value: TokenFormData
}

const DEFAULT_FORM_DATA: TokenFormData = {
  count: 5,
  expiresDays: 90,
  format: 'base64url',
  includeBearer: false,
  length: 32,
  prefix: ''
}

const TOKEN_FORMATS: TokenFormat[] = ['base64url', 'base64', 'hex', 'alphanumeric', 'numeric']

const TOKEN_PRESETS: TokenPreset[] = [
  {
    key: 'api',
    value: {
      count: 3,
      expiresDays: 90,
      format: 'base64url',
      includeBearer: true,
      length: 48,
      prefix: 'sk_'
    }
  },
  {
    key: 'session',
    value: {
      count: 5,
      expiresDays: 14,
      format: 'hex',
      includeBearer: false,
      length: 64,
      prefix: ''
    }
  },
  {
    key: 'otp',
    value: {
      count: 10,
      expiresDays: 1,
      format: 'numeric',
      includeBearer: false,
      length: 6,
      prefix: ''
    }
  },
  {
    key: 'webhook',
    value: {
      count: 5,
      expiresDays: 365,
      format: 'base64url',
      includeBearer: false,
      length: 40,
      prefix: 'whsec_'
    }
  }
]

const CHARSETS = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  numeric: '0123456789'
}
const MAX_TOKEN_VISIBLE_ROWS = 40
const MAX_TOKEN_EXPORT_PREVIEW_ROWS = 40
const MAX_TOKEN_PREFIX_CHARS = 80

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

const getRandomBytes = (byteLength: number) => {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytes
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const generateFromCharset = (length: number, charset: string) => {
  const maxValidByte = Math.floor(256 / charset.length) * charset.length
  let output = ''

  while (output.length < length) {
    const bytes = getRandomBytes(Math.max(16, length - output.length))

    for (const byte of bytes) {
      if (byte >= maxValidByte) continue
      output += charset[byte % charset.length]
      if (output.length === length) break
    }
  }

  return output
}

const generateTokenValue = (format: TokenFormat, length: number) => {
  if (format === 'hex') {
    return Array.from(getRandomBytes(Math.ceil(length / 2)))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length)
  }

  if (format === 'base64' || format === 'base64url') {
    const bytes = getRandomBytes(Math.ceil((length * 3) / 4) + 4)
    const base64 = bytesToBase64(bytes)
    const normalized =
      format === 'base64url'
        ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
        : base64
    return normalized.slice(0, length)
  }

  return generateFromCharset(length, CHARSETS[format])
}

const getEntropyBits = (format: TokenFormat, length: number) => {
  if (format === 'hex') return length * 4
  if (format === 'base64' || format === 'base64url') return length * 6
  if (format === 'alphanumeric') return length * Math.log2(CHARSETS.alphanumeric.length)
  return length * Math.log2(CHARSETS.numeric.length)
}

const formatTokenOutput = (
  tokens: string[],
  output: TokenOutput,
  expiresAt: string,
  includeBearer: boolean
) => {
  const decorated = tokens.map(token => (includeBearer ? `Bearer ${token}` : token))

  if (output === 'json') {
    return JSON.stringify(
      tokens.map((token, index) => ({
        authorization: `Bearer ${token}`,
        expiresAt,
        index: index + 1,
        token
      })),
      null,
      2
    )
  }

  if (output === 'env') {
    return tokens.map((token, index) => `API_TOKEN_${index + 1}=${token}`).join('\n')
  }

  if (output === 'curl') {
    const first = tokens[0] ?? ''
    return `curl -H "Authorization: Bearer ${first}" https://api.example.com/resource`
  }

  if (output === 'bearer') {
    return decorated.join('\n')
  }

  return tokens.join('\n')
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

const TokenClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<TokenFormData>(DEFAULT_FORM_DATA)
  const [outputType, setOutputType] = useState<TokenOutput>('lines')
  const [tokens, setTokens] = useState<string[]>([])

  const normalizedLength = clampNumber(formData.length, 6, 256)
  const normalizedCount = clampNumber(formData.count, 1, 100)
  const normalizedExpiresDays = clampNumber(formData.expiresDays, 1, 3650)
  const normalizedPrefix = formData.prefix.slice(0, MAX_TOKEN_PREFIX_CHARS)
  const entropyBits = useMemo(
    () => Math.floor(getEntropyBits(formData.format, normalizedLength)),
    [formData.format, normalizedLength]
  )
  const outputLength = normalizedPrefix.length + normalizedLength
  const expiresAt = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + normalizedExpiresDays)
    return date.toISOString()
  }, [normalizedExpiresDays])
  const visibleTokens = useMemo(() => tokens.slice(0, MAX_TOKEN_VISIBLE_ROWS), [tokens])
  const exportPreviewTokens = useMemo(
    () => tokens.slice(0, MAX_TOKEN_EXPORT_PREVIEW_ROWS),
    [tokens]
  )
  const exportPreview = useMemo(
    () => formatTokenOutput(exportPreviewTokens, outputType, expiresAt, formData.includeBearer),
    [expiresAt, exportPreviewTokens, formData.includeBearer, outputType]
  )
  const isRowPreviewLimited = tokens.length > visibleTokens.length
  const isExportPreviewLimited = outputType !== 'curl' && tokens.length > exportPreviewTokens.length

  const handleGenerate = useCallback(() => {
    const nextTokens = Array.from({ length: normalizedCount }, () => {
      return `${normalizedPrefix}${generateTokenValue(formData.format, normalizedLength)}`
    })

    setTokens(nextTokens)
    toast.success(t('public.success'))
  }, [formData.format, normalizedCount, normalizedLength, normalizedPrefix, toast, t])

  const handleApplyPreset = useCallback((preset: TokenPreset) => {
    setFormData(preset.value)
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
    setOutputType('lines')
    setTokens([])
  }, [])

  const handleCopyAll = useCallback(() => {
    if (!tokens.length) return
    void copy(formatTokenOutput(tokens, outputType, expiresAt, formData.includeBearer))
  }, [copy, expiresAt, formData.includeBearer, outputType, tokens])

  const handleDownload = useCallback(() => {
    if (!tokens.length) return
    const extension = outputType === 'json' ? 'json' : outputType === 'env' ? 'env' : 'txt'
    const mime =
      outputType === 'json'
        ? 'application/json;charset=utf-8'
        : outputType === 'env'
          ? 'text/plain;charset=utf-8'
          : 'text/plain;charset=utf-8'

    downloadText(
      formatTokenOutput(tokens, outputType, expiresAt, formData.includeBearer),
      `daily-tools-tokens.${extension}`,
      mime
    )
  }, [expiresAt, formData.includeBearer, outputType, tokens])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('app.generation.token')}</CardTitle>
              <CardDescription>{t('app.generation.token.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="token-format">{t('app.generation.token.format')}</Label>
                <Select
                  id="token-format"
                  value={formData.format}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      format: event.target.value as TokenFormat
                    }))
                  }
                >
                  {TOKEN_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.generation.token.format.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-prefix">{t('app.generation.token.prefix')}</Label>
                <Input
                  id="token-prefix"
                  value={formData.prefix}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      prefix: event.target.value.slice(0, MAX_TOKEN_PREFIX_CHARS)
                    }))
                  }
                  placeholder="sk_"
                  className="font-mono"
                />
                <InputCapNotice
                  visible={formData.prefix.length >= MAX_TOKEN_PREFIX_CHARS}
                  limit={MAX_TOKEN_PREFIX_CHARS}
                />
              </div>

              <div className="space-y-3">
                <Label>
                  {t('app.generation.token.length')}: {normalizedLength}
                </Label>
                <Slider
                  value={normalizedLength}
                  min={6}
                  max={256}
                  step={1}
                  onChange={value =>
                    setFormData(prev => ({
                      ...prev,
                      length: value
                    }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-count">{t('app.generation.token.count')}</Label>
                <Input
                  id="token-count"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.count}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      count: Number(event.target.value)
                    }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-expires">{t('app.generation.token.expires_days')}</Label>
                <Input
                  id="token-expires"
                  type="number"
                  min={1}
                  max={3650}
                  value={formData.expiresDays}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      expiresDays: Number(event.target.value)
                    }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="token-output">{t('app.generation.token.output_type')}</Label>
                <Select
                  id="token-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as TokenOutput)}
                >
                  {(['lines', 'bearer', 'env', 'curl', 'json'] as const).map(output => (
                    <option key={output} value={output}>
                      {t(`app.generation.token.output.${output}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Metric
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t('app.generation.token.entropy')}
                value={entropyBits}
              />
              <Metric
                icon={<KeyRound className="h-4 w-4" />}
                label={t('app.generation.token.output_length')}
                value={outputLength}
              />
              <Metric label={t('app.generation.token.expires_at')} value={expiresAt.slice(0, 10)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Checkbox
              checked={formData.includeBearer}
              onChange={event =>
                setFormData(prev => ({
                  ...prev,
                  includeBearer: event.target.checked
                }))
              }
              label={t('app.generation.token.include_bearer')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TOKEN_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleApplyPreset(preset)}
              >
                {t(`app.generation.token.preset.${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              icon={<KeyRound className="h-4 w-4" />}
              onClick={handleGenerate}
            >
              {t('public.generate')}
            </Button>
            <Button
              type="button"
              variant="default"
              icon={<Copy className="h-4 w-4" />}
              disabled={!tokens.length}
              onClick={handleCopyAll}
            >
              {t('app.generation.token.copy_all')}
            </Button>
            <Button
              type="button"
              variant="default"
              icon={<FileDown className="h-4 w-4" />}
              disabled={!tokens.length}
              onClick={handleDownload}
            >
              {t('app.generation.token.download')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('app.generation.token.result')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {tokens.length ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="flex flex-col gap-3">
                {visibleTokens.map((token, index) => (
                  <div
                    key={`${token}-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3"
                  >
                    <code className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--text-primary)]">
                      {token}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => void copy(token)}
                      aria-label={t('public.copy')}
                    />
                  </div>
                ))}
                {isRowPreviewLimited && (
                  <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {t('app.generation.token.rows_limited', {
                      total: tokens.length,
                      visible: visibleTokens.length
                    })}
                  </div>
                )}
              </div>

              <div className="glass-input rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                  <FileJson className="h-4 w-4" />
                  {t('app.generation.token.export_preview')}
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                  {exportPreview}
                </pre>
                {isExportPreviewLimited && (
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                    {t('app.generation.token.preview_limited', {
                      total: tokens.length,
                      visible: exportPreviewTokens.length
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-center">
              <div className="max-w-sm space-y-3">
                <div className="glass-panel glass-shimmer glass-clip mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                  <KeyRound className="h-7 w-7 text-[var(--text-secondary)]" />
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.generation.token.empty')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

export default TokenClient
