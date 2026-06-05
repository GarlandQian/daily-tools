'use client'

import { Copy, KeyRound, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/toast'

type TokenFormat = 'base64url' | 'base64' | 'hex' | 'alphanumeric' | 'numeric'

interface TokenFormData {
  format: TokenFormat
  length: number
  count: number
  prefix: string
}

interface TokenPreset {
  key: string
  value: TokenFormData
}

const DEFAULT_FORM_DATA: TokenFormData = {
  format: 'base64url',
  length: 32,
  count: 5,
  prefix: ''
}

const TOKEN_FORMATS: TokenFormat[] = ['base64url', 'base64', 'hex', 'alphanumeric', 'numeric']

const TOKEN_PRESETS: TokenPreset[] = [
  {
    key: 'api',
    value: {
      format: 'base64url',
      length: 48,
      count: 3,
      prefix: 'sk_'
    }
  },
  {
    key: 'session',
    value: {
      format: 'hex',
      length: 64,
      count: 5,
      prefix: ''
    }
  },
  {
    key: 'otp',
    value: {
      format: 'numeric',
      length: 6,
      count: 10,
      prefix: ''
    }
  }
]

const CHARSETS = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  numeric: '0123456789'
}

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

const TokenClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [tokens, setTokens] = useState<string[]>([])
  const [formData, setFormData] = useState<TokenFormData>(DEFAULT_FORM_DATA)

  const normalizedLength = clampNumber(formData.length, 6, 256)
  const normalizedCount = clampNumber(formData.count, 1, 100)
  const entropyBits = useMemo(
    () => Math.floor(getEntropyBits(formData.format, normalizedLength)),
    [formData.format, normalizedLength]
  )
  const outputLength = formData.prefix.length + normalizedLength

  const handleGenerate = useCallback(() => {
    const nextTokens = Array.from({ length: normalizedCount }, () => {
      return `${formData.prefix}${generateTokenValue(formData.format, normalizedLength)}`
    })

    setTokens(nextTokens)
    toast.success(t('public.success'))
  }, [formData.format, formData.prefix, normalizedCount, normalizedLength, toast, t])

  const handleApplyPreset = useCallback((preset: TokenPreset) => {
    setFormData(preset.value)
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
    setTokens([])
  }, [])

  const handleCopy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.success(t('public.copy.success'))
      } catch {
        toast.error(t('public.error'))
      }
    },
    [toast, t]
  )

  const handleCopyAll = useCallback(() => {
    if (!tokens.length) return
    void handleCopy(tokens.join('\n'))
  }, [handleCopy, tokens])

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
                      prefix: event.target.value
                    }))
                  }
                  placeholder="sk_"
                  className="font-mono"
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
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <ShieldCheck className="h-4 w-4" />
                  {t('app.generation.token.entropy')}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                  {entropyBits}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <KeyRound className="h-4 w-4" />
                  {t('app.generation.token.output_length')}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                  {outputLength}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {t('app.generation.token.amount')}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                  {normalizedCount}
                </div>
              </div>
            </div>
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
              {t('app.generation.uuid.copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[280px] flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('app.generation.token.result')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {tokens.length ? (
            <div className="flex flex-col gap-3">
              {tokens.map((token, index) => (
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
                    onClick={() => void handleCopy(token)}
                    aria-label={t('public.copy')}
                  />
                </div>
              ))}
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

export default TokenClient
