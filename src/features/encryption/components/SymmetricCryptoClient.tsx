'use client'

import {
  AlertTriangle,
  ArrowDownUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Unlock
} from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

import {
  aesCrypto,
  type AesCryptoOptions,
  aesEncodings,
  aesFormats,
  aesModes,
  aesPaddings,
  desCrypto,
  TripleDesCrypto
} from '../utils'

type SymmetricAlgorithm = 'aes' | 'des' | 'tripledes'
type Operation = 'encrypt' | 'decrypt'

interface SymmetricCryptoClientProps {
  algorithm: SymmetricAlgorithm
}

interface Preset {
  content: string
  encoding?: AesCryptoOptions['encoding']
  format?: AesCryptoOptions['format']
  iv: string
  key: string
  mode: AesCryptoOptions['mode']
  padding?: AesCryptoOptions['padding']
}

const MAX_INPUT_CHARS = 200000
const metricNumberFormatter = new Intl.NumberFormat()

const ALGORITHM_META: Record<
  SymmetricAlgorithm,
  {
    defaultIv: string
    defaultKey: string
    descriptionKey: string
    keyHint: string
    labelKey: string
    legacy: boolean
    title: string
  }
> = {
  aes: {
    defaultIv: '1234567890abcdef',
    defaultKey: 'dailytoolskey1234',
    descriptionKey: 'app.encryption.symmetric.description.aes',
    keyHint: '16 / 24 / 32 bytes',
    labelKey: 'app.encryption.aes',
    legacy: false,
    title: 'AES'
  },
  des: {
    defaultIv: '12345678',
    defaultKey: 'deskey12',
    descriptionKey: 'app.encryption.symmetric.description.des',
    keyHint: '8 bytes',
    labelKey: 'app.encryption.des',
    legacy: true,
    title: 'DES'
  },
  tripledes: {
    defaultIv: '12345678',
    defaultKey: 'daily-tools-3des-key-24',
    descriptionKey: 'app.encryption.symmetric.description.tripledes',
    keyHint: '16 / 24 bytes',
    labelKey: 'app.encryption.tripleDes',
    legacy: true,
    title: 'Triple DES'
  }
}

const PRESETS: Record<SymmetricAlgorithm, Preset[]> = {
  aes: [
    {
      content: '{"user":"daily-tools","scope":"local-preview","expires":"2026-12-31"}',
      iv: '1234567890abcdef',
      key: 'dailytoolskey1234',
      mode: 'CBC'
    },
    {
      content: 'feature_flag=liquid_glass\nregion=local',
      format: 'OpenSSL',
      iv: '',
      key: 'dailytoolskey1234',
      mode: 'ECB'
    }
  ],
  des: [
    {
      content: 'legacy message for local compatibility test',
      iv: '12345678',
      key: 'deskey12',
      mode: 'CBC'
    }
  ],
  tripledes: [
    {
      content: 'partner-payload=local-demo&version=3des',
      iv: '12345678',
      key: 'daily-tools-3des-key-24',
      mode: 'CBC'
    }
  ]
}

const getCrypto = (algorithm: SymmetricAlgorithm) => {
  if (algorithm === 'aes') return aesCrypto
  if (algorithm === 'des') return desCrypto
  return TripleDesCrypto
}

const countBytes = (value: string) => new TextEncoder().encode(value).length

const downloadText = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const SymmetricCryptoClient = ({ algorithm }: SymmetricCryptoClientProps) => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const meta = ALGORITHM_META[algorithm]
  const cryptoFn = getCrypto(algorithm)
  const [operation, setOperation] = useState<Operation>('encrypt')
  const [content, setContent] = useState('')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [mode, setMode] = useState<AesCryptoOptions['mode']>('CBC')
  const [padding, setPadding] = useState<AesCryptoOptions['padding']>('Pkcs7')
  const [format, setFormat] = useState<AesCryptoOptions['format']>('Hex')
  const [encoding, setEncoding] = useState<AesCryptoOptions['encoding']>('Utf8')
  const [iv, setIv] = useState(meta.defaultIv)
  const [result, setResult] = useState('')

  const contentBytes = useMemo(() => countBytes(content), [content])
  const secretBytes = useMemo(() => countBytes(secret), [secret])
  const ivBytes = useMemo(() => countBytes(iv), [iv])
  const outputBytes = useMemo(() => countBytes(result), [result])
  const isInputTooLarge = content.length > MAX_INPUT_CHARS
  const warnings = useMemo(() => {
    const next: string[] = []
    if (meta.legacy) next.push(t('app.encryption.symmetric.warning.legacy'))
    if (mode === 'ECB') next.push(t('app.encryption.symmetric.warning.ecb'))
    if (padding === 'NoPadding') next.push(t('app.encryption.symmetric.warning.no_padding'))
    if (isInputTooLarge) {
      next.push(
        t('app.encryption.symmetric.warning.too_large', {
          limit: metricNumberFormatter.format(MAX_INPUT_CHARS)
        })
      )
    }
    if (operation === 'decrypt' && format === 'Hex' && /[^a-f0-9]/i.test(content.trim())) {
      next.push(t('app.encryption.symmetric.warning.hex_input'))
    }
    return next
  }, [content, format, isInputTooLarge, meta.legacy, mode, operation, padding, t])

  const options = useMemo<AesCryptoOptions>(
    () => ({ encoding, format, iv, mode, padding }),
    [encoding, format, iv, mode, padding]
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!content.trim()) {
      toast.warning(t('app.encryption.aes.content_required'))
      return
    }
    if (!secret.trim()) {
      toast.warning(t('app.encryption.aes.password_required'))
      return
    }
    if (isInputTooLarge) {
      toast.warning(
        t('app.encryption.symmetric.warning.too_large', {
          limit: metricNumberFormatter.format(MAX_INPUT_CHARS)
        })
      )
      return
    }

    try {
      const nextResult = cryptoFn(content, secret, options, operation === 'encrypt')
      if (operation === 'decrypt' && !nextResult) {
        throw new Error('app.encryption.aes.decrypt_failed_empty')
      }
      setResult(nextResult)
    } catch (error) {
      if (operation === 'encrypt') {
        toast.error(
          error instanceof Error ? t(error.message) : t('app.encryption.aes.encrypt_failed')
        )
      } else {
        toast.warning(
          error instanceof Error ? t(error.message) : t('app.encryption.aes.decrypt_failed')
        )
        setResult('')
      }
    }
  }

  const applyPreset = (preset: Preset) => {
    setContent(preset.content)
    setSecret(preset.key)
    setIv(preset.iv)
    setMode(preset.mode)
    setPadding(preset.padding ?? 'Pkcs7')
    setFormat(preset.format ?? 'Hex')
    setEncoding(preset.encoding ?? 'Utf8')
    setOperation('encrypt')
    setResult('')
  }

  const reset = () => {
    setContent('')
    setSecret('')
    setIv(meta.defaultIv)
    setMode('CBC')
    setPadding('Pkcs7')
    setFormat('Hex')
    setEncoding('Utf8')
    setOperation('encrypt')
    setResult('')
  }

  const useOutputAsInput = () => {
    setContent(result)
    setOperation('decrypt')
    setResult('')
  }

  const exportPayload = useMemo(
    () =>
      JSON.stringify(
        {
          algorithm: meta.title,
          contentBytes,
          encoding,
          format,
          ivBytes,
          mode,
          operation,
          output: result,
          outputBytes,
          padding
        },
        null,
        2
      ),
    [
      contentBytes,
      encoding,
      format,
      ivBytes,
      meta.title,
      mode,
      operation,
      outputBytes,
      padding,
      result
    ]
  )

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[var(--primary)]" />
                {t(meta.labelKey)}
              </CardTitle>
              <CardDescription>{t(meta.descriptionKey)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS[algorithm].map((preset, index) => (
              <Button
                key={`${algorithm}-${index}`}
                type="button"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => applyPreset(preset)}
              >
                {t('app.encryption.symmetric.sample', { index: index + 1 })}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.encryption.symmetric.metric.input')} value={contentBytes} />
            <Metric label={t('app.encryption.symmetric.metric.key')} value={secretBytes} />
            <Metric label={t('app.encryption.symmetric.metric.iv')} value={ivBytes} />
            <Metric label={t('app.encryption.symmetric.metric.output')} value={outputBytes} />
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map(warning => (
                <div
                  key={warning}
                  className="flex items-start gap-2 rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <form
        onSubmit={handleSubmit}
        className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]"
      >
        <Card className="min-h-[560px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.encryption.symmetric.input')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label>{t('app.encryption.aes.action')}</Label>
              <RadioGroup
                value={operation}
                onValueChange={value => {
                  setOperation(value as Operation)
                  setResult('')
                }}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="encrypt" id={`${algorithm}-encrypt`} />
                  <Label
                    htmlFor={`${algorithm}-encrypt`}
                    className="flex cursor-pointer items-center gap-1"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {t('app.encryption.aes.encrypt')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="decrypt" id={`${algorithm}-decrypt`} />
                  <Label
                    htmlFor={`${algorithm}-decrypt`}
                    className="flex cursor-pointer items-center gap-1"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    {t('app.encryption.aes.decrypt')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label htmlFor={`${algorithm}-content`}>{t('app.encryption.aes.content')}</Label>
              <Textarea
                id={`${algorithm}-content`}
                rows={8}
                value={content}
                onChange={event => setContent(event.target.value)}
                placeholder={t('app.encryption.symmetric.content_placeholder')}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-3">
                <Label htmlFor={`${algorithm}-secret`}>
                  {t('app.encryption.aes.password')} · {meta.keyHint}
                </Label>
                <Input
                  id={`${algorithm}-secret`}
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={event => setSecret(event.target.value)}
                  placeholder={meta.defaultKey}
                  className="font-mono"
                />
              </div>
              <Button
                type="button"
                variant="default"
                icon={showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                onClick={() => setShowSecret(value => !value)}
                className="self-end"
              >
                {showSecret
                  ? t('app.encryption.symmetric.hide_secret')
                  : t('app.encryption.symmetric.show_secret')}
              </Button>
            </div>

            <div className="space-y-3">
              <Label htmlFor={`${algorithm}-iv`}>{t('app.encryption.aes.iv')}</Label>
              <Input
                id={`${algorithm}-iv`}
                value={iv}
                onChange={event => setIv(event.target.value)}
                placeholder={t('app.encryption.aes.iv_placeholder')}
                className="font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[560px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.encryption.symmetric.options')}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <FieldSelect
                id={`${algorithm}-mode`}
                label={t('app.encryption.aes.mode')}
                value={mode}
                onChange={value => setMode(value as AesCryptoOptions['mode'])}
                options={aesModes}
              />
              <FieldSelect
                id={`${algorithm}-padding`}
                label={t('app.encryption.aes.padding')}
                value={padding}
                onChange={value => setPadding(value as AesCryptoOptions['padding'])}
                options={aesPaddings}
              />
              <FieldSelect
                id={`${algorithm}-format`}
                label={t('app.encryption.aes.format')}
                value={format}
                onChange={value => setFormat(value as AesCryptoOptions['format'])}
                options={aesFormats}
              />
              <FieldSelect
                id={`${algorithm}-encoding`}
                label={t('app.encryption.aes.encoding')}
                value={encoding}
                onChange={value => setEncoding(value as AesCryptoOptions['encoding'])}
                options={aesEncodings}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={
                operation === 'encrypt' ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )
              }
              disabled={isInputTooLarge}
            >
              {operation === 'encrypt'
                ? t('app.encryption.aes.encrypt')
                : t('app.encryption.aes.decrypt')}
            </Button>

            <div className="min-h-0 flex-1 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`${algorithm}-result`}>{t('app.hash.result')}</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => copy(result)}
                    disabled={!result}
                  >
                    {t('public.copy')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<FileText className="h-3.5 w-3.5" />}
                    onClick={() => copy(exportPayload)}
                    disabled={!result}
                  >
                    JSON
                  </Button>
                </div>
              </div>
              <Textarea
                id={`${algorithm}-result`}
                readOnly
                value={result}
                rows={9}
                placeholder={t('app.encryption.symmetric.output_placeholder')}
                className="font-mono text-sm"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  type="button"
                  variant="default"
                  icon={<ArrowDownUp className="h-4 w-4" />}
                  onClick={useOutputAsInput}
                  disabled={!result}
                >
                  {t('app.encryption.symmetric.use_output')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => downloadText(result, `${algorithm}-result.txt`)}
                  disabled={!result}
                >
                  {t('app.encryption.symmetric.download')}
                </Button>
              </div>
            </div>

            <div className="glass-input rounded-2xl p-4">
              <div className="flex items-start gap-2">
                {meta.legacy ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                ) : (
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                )}
                <p className="text-xs leading-5 text-[var(--text-secondary)]">
                  {t(
                    meta.legacy
                      ? 'app.encryption.symmetric.legacy_note'
                      : 'app.encryption.symmetric.aes_note'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

const FieldSelect = ({
  id,
  label,
  onChange,
  options,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  </div>
)

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
      {metricNumberFormatter.format(value)}
    </div>
  </div>
)

export default SymmetricCryptoClient
