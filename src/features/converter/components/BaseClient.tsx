'use client'

import {
  ArrowLeftRight,
  Binary,
  Copy,
  Download,
  FileCode2,
  Hash,
  Table2,
  Trash2
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface BaseValues {
  binary: string
  octal: string
  decimal: string
  hex: string
}

type BatchInputBase = 'auto' | '2' | '8' | '10' | '16'
type BatchOutputBase = '2' | '8' | '10' | '16' | 'custom'
type ExportFormat = 'summary' | 'json' | 'csv' | 'literals'

interface BatchResult {
  input: string
  output: string
  valid: boolean
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BIGINT_ZERO = BigInt(0)
const BIGINT_TWO = BigInt(2)
const BIGINT_ONE = BigInt(1)
const MAX_BASE_INPUT_DIGITS = 10000
const MAX_BATCH_ROWS = 120
const baseNumberFormatter = new Intl.NumberFormat()

const formatBaseNumber = (value: number) => baseNumberFormatter.format(value)

const getIntegerDigitCount = (value: string) => {
  const trimmed = value.trim()
  const digits = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed
  return digits.length
}

const parseInteger = (value: string, base: number) => {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '-') return null

  const negative = trimmed.startsWith('-')
  const digits = negative ? trimmed.slice(1) : trimmed
  if (!digits) return null

  let result = BIGINT_ZERO

  for (const char of digits.toUpperCase()) {
    const digit = DIGITS.indexOf(char)
    if (digit < 0 || digit >= base) return null
    result = result * BigInt(base) + BigInt(digit)
  }

  return negative ? -result : result
}

const formatInteger = (value: bigint, base: number) => {
  const negative = value < BIGINT_ZERO
  const body = (negative ? -value : value).toString(base).toUpperCase()
  return `${negative ? '-' : ''}${body}`
}

const sanitizeInput = (value: string, allowed: RegExp) => {
  const negative = value.trimStart().startsWith('-')
  const body = value.replaceAll('-', '').replace(allowed, '')
  return `${negative ? '-' : ''}${body}`
}

const sanitizeForBase = (value: string, base: number) => {
  const negative = value.trimStart().startsWith('-')
  const body = value
    .replaceAll('-', '')
    .toUpperCase()
    .split('')
    .filter(char => {
      const digit = DIGITS.indexOf(char)
      return digit >= 0 && digit < base
    })
    .join('')

  return `${negative ? '-' : ''}${body}`
}

const clampInteger = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

const detectBase = (value: string) => {
  const trimmed = value.trim()
  const body = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed
  if (/^0b[01]+$/i.test(body))
    return { base: 2, value: `${trimmed.startsWith('-') ? '-' : ''}${body.slice(2)}` }
  if (/^0o[0-7]+$/i.test(body))
    return { base: 8, value: `${trimmed.startsWith('-') ? '-' : ''}${body.slice(2)}` }
  if (/^0x[0-9a-f]+$/i.test(body))
    return { base: 16, value: `${trimmed.startsWith('-') ? '-' : ''}${body.slice(2)}` }
  if (/^[01]+$/i.test(body) && body.length > 1) return { base: 2, value: trimmed }
  if (/^[0-7]+$/i.test(body) && /^0/.test(body) && body.length > 1)
    return { base: 8, value: trimmed }
  return { base: 10, value: trimmed }
}

const stripKnownPrefix = (value: string) => {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const body = negative ? trimmed.slice(1) : trimmed
  const stripped = body.replace(/^0[bxo]/i, '')
  return `${negative ? '-' : ''}${stripped}`
}

const groupDigits = (value: string, size: number) => {
  if (!value) return ''
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  const groups: string[] = []
  for (let index = body.length; index > 0; index -= size) {
    groups.unshift(body.slice(Math.max(0, index - size), index))
  }
  return `${negative ? '-' : ''}${groups.join(' ')}`
}

const formatWithPrefix = (value: string, prefix: string) => {
  if (!value) return ''
  if (!prefix) return value
  return value.startsWith('-') ? `-${prefix}${value.slice(1)}` : `${prefix}${value}`
}

const toTwosComplement = (value: bigint, bits: number) => {
  const width = clampInteger(bits, 4, 4096, 32)
  const modulus = BIGINT_ONE << BigInt(width)
  const normalized = value < BIGINT_ZERO ? modulus + value : value
  if (normalized < BIGINT_ZERO || normalized >= modulus) return null
  return normalized.toString(2).padStart(width, '0')
}

const csvEscape = (value: string | boolean) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
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

const BaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [values, setValues] = useState<BaseValues>({
    binary: '',
    octal: '',
    decimal: '',
    hex: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [customBase, setCustomBase] = useState(36)
  const [customInput, setCustomInput] = useState('')
  const [twosBits, setTwosBits] = useState(32)
  const [batchInput, setBatchInput] = useState('0b101010\n0xff\n755\n2026')
  const [batchInputBase, setBatchInputBase] = useState<BatchInputBase>('auto')
  const [batchOutputBase, setBatchOutputBase] = useState<BatchOutputBase>('16')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('summary')

  const updateAllBases = useCallback(
    (value: string, fromBase: number) => {
      if (!value.trim()) {
        setValues({ binary: '', octal: '', decimal: '', hex: '' })
        setError(null)
        return
      }

      if (getIntegerDigitCount(value) > MAX_BASE_INPUT_DIGITS) {
        setError(
          t('app.converter.base.warning.too_large', {
            limit: formatBaseNumber(MAX_BASE_INPUT_DIGITS)
          })
        )
        return
      }

      const decimal = parseInteger(value, fromBase)
      if (decimal === null) {
        setError(t('app.converter.base.invalid'))
        return
      }

      setValues({
        binary: formatInteger(decimal, 2),
        octal: formatInteger(decimal, 8),
        decimal: formatInteger(decimal, 10),
        hex: formatInteger(decimal, 16)
      })
      setError(null)
    },
    [t]
  )

  const handleBinaryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeInput(e.target.value, /[^01]/g)
      setValues(prev => ({ ...prev, binary: value }))
      updateAllBases(value, 2)
    },
    [updateAllBases]
  )

  const handleOctalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeInput(e.target.value, /[^0-7]/g)
      setValues(prev => ({ ...prev, octal: value }))
      updateAllBases(value, 8)
    },
    [updateAllBases]
  )

  const handleDecimalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeInput(e.target.value, /[^0-9]/g)
      setValues(prev => ({ ...prev, decimal: value }))
      updateAllBases(value, 10)
    },
    [updateAllBases]
  )

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeInput(e.target.value, /[^0-9A-Fa-f]/g).toUpperCase()
      setValues(prev => ({ ...prev, hex: value }))
      updateAllBases(value, 16)
    },
    [updateAllBases]
  )

  const handleCustomChange = useCallback(
    (value: string) => {
      const sanitized = sanitizeForBase(value, customBase)
      setCustomInput(sanitized)
      updateAllBases(sanitized, customBase)
    },
    [customBase, updateAllBases]
  )

  const handleClear = useCallback(() => {
    setValues({ binary: '', octal: '', decimal: '', hex: '' })
    setCustomInput('')
    setError(null)
  }, [])

  const decimalValue = useMemo(() => {
    if (getIntegerDigitCount(values.decimal) > MAX_BASE_INPUT_DIGITS) return null
    return parseInteger(values.decimal, 10)
  }, [values.decimal])
  const integerStats = useMemo(() => {
    if (decimalValue === null) return null

    const magnitude = decimalValue < BIGINT_ZERO ? -decimalValue : decimalValue
    const bitLength = magnitude === BIGINT_ZERO ? 1 : magnitude.toString(2).length
    const byteLength = Math.ceil(bitLength / 8)

    return {
      bitLength,
      byteLength,
      sign:
        decimalValue < BIGINT_ZERO
          ? t('app.converter.base.negative')
          : t('app.converter.base.non_negative'),
      parity:
        magnitude % BIGINT_TWO === BIGINT_ZERO
          ? t('app.converter.base.even')
          : t('app.converter.base.odd')
    }
  }, [decimalValue, t])

  const customOutput = useMemo(() => {
    if (decimalValue === null) return ''
    return formatInteger(decimalValue, customBase)
  }, [customBase, decimalValue])

  const groupedValues = useMemo(
    () => ({
      binary: groupDigits(values.binary, 4),
      decimal: groupDigits(values.decimal, 3),
      hex: groupDigits(values.hex, 2),
      octal: groupDigits(values.octal, 3)
    }),
    [values]
  )

  const twosComplement = useMemo(
    () => (decimalValue === null ? null : toTwosComplement(decimalValue, twosBits)),
    [decimalValue, twosBits]
  )

  const batchResults = useMemo<BatchResult[]>(() => {
    const outputBase = batchOutputBase === 'custom' ? customBase : Number(batchOutputBase)
    return batchInput
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, MAX_BATCH_ROWS)
      .map(input => {
        const detected =
          batchInputBase === 'auto'
            ? detectBase(input)
            : { base: Number(batchInputBase), value: stripKnownPrefix(input) }
        if (getIntegerDigitCount(detected.value) > MAX_BASE_INPUT_DIGITS) {
          return { input, output: t('app.converter.base.too_large_short'), valid: false }
        }
        const parsed = parseInteger(detected.value, detected.base)
        if (parsed === null) return { input, output: t('app.converter.base.invalid'), valid: false }
        return { input, output: formatInteger(parsed, outputBase), valid: true }
      })
  }, [batchInput, batchInputBase, batchOutputBase, customBase, t])

  const validBatchCount = batchResults.filter(item => item.valid).length
  const exportText = useMemo(() => {
    if (exportFormat === 'json') return JSON.stringify(batchResults, null, 2)
    if (exportFormat === 'csv') {
      return [
        'input,output,valid',
        ...batchResults.map(item => [item.input, item.output, item.valid].map(csvEscape).join(','))
      ].join('\n')
    }
    if (exportFormat === 'literals') {
      return [
        `binary = ${formatWithPrefix(values.binary, '0b')}`,
        `octal = ${formatWithPrefix(values.octal, '0o')}`,
        `decimal = ${values.decimal}`,
        `hex = ${formatWithPrefix(values.hex, '0x')}`,
        `base${customBase} = ${customOutput}`
      ].join('\n')
    }
    return [
      `${t('app.converter.base.binary')}: ${formatWithPrefix(values.binary, '0b')}`,
      `${t('app.converter.base.octal')}: ${formatWithPrefix(values.octal, '0o')}`,
      `${t('app.converter.base.decimal')}: ${values.decimal}`,
      `${t('app.converter.base.hex')}: ${formatWithPrefix(values.hex, '0x')}`,
      `${t('app.converter.base.custom_base')} ${customBase}: ${customOutput}`,
      `${t('app.converter.base.twos_complement')}: ${twosComplement ?? '-'}`
    ].join('\n')
  }, [batchResults, customBase, customOutput, exportFormat, t, twosComplement, values])

  const handleCopyAll = () => {
    void copy(exportText)
  }

  const baseInputs = [
    {
      label: t('app.converter.base.binary'),
      prefix: '0b',
      value: values.binary,
      onChange: handleBinaryChange,
      placeholder: '1010'
    },
    {
      label: t('app.converter.base.octal'),
      prefix: '0o',
      value: values.octal,
      onChange: handleOctalChange,
      placeholder: '12'
    },
    {
      label: t('app.converter.base.decimal'),
      prefix: '',
      value: values.decimal,
      onChange: handleDecimalChange,
      placeholder: '10'
    },
    {
      label: t('app.converter.base.hex'),
      prefix: '0x',
      value: values.hex,
      onChange: handleHexChange,
      placeholder: 'A'
    }
  ]

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.base')}
              </CardTitle>
              <CardDescription>{t('app.converter.base.hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                icon={<Copy className="w-4 h-4" />}
                onClick={handleCopyAll}
                disabled={!values.decimal}
              >
                {t('app.generation.uuid.copy')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleClear}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {integerStats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <BaseMetric
                label={t('app.converter.base.bit_length')}
                value={String(integerStats.bitLength)}
              />
              <BaseMetric
                label={t('app.converter.base.byte_length')}
                value={String(integerStats.byteLength)}
              />
              <BaseMetric label={t('app.converter.base.parity')} value={integerStats.parity} />
              <BaseMetric label={t('app.converter.base.sign')} value={integerStats.sign} />
              <BaseMetric
                label={t('app.converter.base.batch_valid')}
                value={`${validBatchCount}/${batchResults.length}`}
              />
            </div>
          )}
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {baseInputs.map(item => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-base">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  {item.prefix ? (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm font-mono">
                      {item.prefix}
                    </span>
                  ) : (
                    <ArrowLeftRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  )}
                  <Input
                    value={item.value}
                    onChange={item.onChange}
                    placeholder={item.placeholder}
                    className={`font-mono h-12 text-base ${item.prefix ? 'pl-10' : 'pl-10'}`}
                  />
                </div>
                <Button
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => copy(item.value)}
                  disabled={!item.value}
                >
                  {t('public.copy')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.base.custom_base')}
            </CardTitle>
            <CardDescription>{t('app.converter.base.custom_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Label htmlFor="base-custom-base">{t('app.converter.base.base')}</Label>
                <Input
                  id="base-custom-base"
                  type="number"
                  min={2}
                  max={36}
                  value={customBase}
                  onChange={event => {
                    const nextBase = clampInteger(Number(event.target.value), 2, 36, customBase)
                    setCustomBase(nextBase)
                    setCustomInput(current => sanitizeForBase(current, nextBase))
                  }}
                  className="font-mono"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="base-custom-input">{t('app.converter.base.custom_value')}</Label>
                <Input
                  id="base-custom-input"
                  value={customInput}
                  onChange={event => handleCustomChange(event.target.value)}
                  placeholder="HELLO2026"
                  className="font-mono uppercase"
                />
              </div>
            </div>
            <CopyRow
              label={`${t('app.converter.base.custom_base')} ${customBase}`}
              value={customOutput}
              onCopy={() => void copy(customOutput)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Binary className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.base.twos_complement')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="base-twos-bits">{t('app.converter.base.bit_width')}</Label>
              <Select
                id="base-twos-bits"
                value={String(twosBits)}
                onChange={event => setTwosBits(Number(event.target.value))}
              >
                {[8, 16, 32, 64, 128].map(bits => (
                  <option key={bits} value={bits}>
                    {bits}
                  </option>
                ))}
              </Select>
            </div>
            <CopyRow
              label={t('app.converter.base.twos_complement')}
              value={
                twosComplement
                  ? groupDigits(twosComplement, 4)
                  : t('app.converter.base.out_of_range')
              }
              onCopy={() => void copy(twosComplement ?? '')}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Table2 className="h-4 w-4 text-[var(--primary)]" />
            {t('app.converter.base.batch')}
          </CardTitle>
          <CardDescription>
            {t('app.converter.base.batch_hint', { limit: MAX_BATCH_ROWS })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Textarea
              value={batchInput}
              onChange={event => setBatchInput(event.target.value)}
              rows={9}
              className="font-mono"
              placeholder="0b1010&#10;0xff&#10;2026"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('app.converter.base.input_base')}</Label>
                <Select
                  value={batchInputBase}
                  onChange={event => setBatchInputBase(event.target.value as BatchInputBase)}
                >
                  <option value="auto">{t('app.converter.base.auto_detect')}</option>
                  <option value="2">{t('app.converter.base.binary')}</option>
                  <option value="8">{t('app.converter.base.octal')}</option>
                  <option value="10">{t('app.converter.base.decimal')}</option>
                  <option value="16">{t('app.converter.base.hex')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('app.converter.base.output_base')}</Label>
                <Select
                  value={batchOutputBase}
                  onChange={event => setBatchOutputBase(event.target.value as BatchOutputBase)}
                >
                  <option value="2">{t('app.converter.base.binary')}</option>
                  <option value="8">{t('app.converter.base.octal')}</option>
                  <option value="10">{t('app.converter.base.decimal')}</option>
                  <option value="16">{t('app.converter.base.hex')}</option>
                  <option value="custom">{t('app.converter.base.custom_base')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('app.converter.base.export')}</Label>
                <Select
                  value={exportFormat}
                  onChange={event => setExportFormat(event.target.value as ExportFormat)}
                >
                  <option value="summary">{t('app.converter.base.export.summary')}</option>
                  <option value="json">{t('app.converter.base.export.json')}</option>
                  <option value="csv">{t('app.converter.base.export.csv')}</option>
                  <option value="literals">{t('app.converter.base.export.literals')}</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {batchResults.map((item, index) => (
                <div
                  key={`${item.input}-${index}`}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {item.input}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--text-secondary)]">
                        {item.output}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                        item.valid
                          ? 'bg-[var(--success-subtle)] text-[var(--success)]'
                          : 'bg-[var(--error-subtle)] text-[var(--error)]'
                      }`}
                    >
                      {item.valid ? t('app.converter.base.valid') : t('app.converter.base.invalid')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(exportText)}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    exportText,
                    `base-converter.${exportFormat === 'json' ? 'json' : exportFormat === 'csv' ? 'csv' : 'txt'}`,
                    exportFormat === 'json'
                      ? 'application/json;charset=utf-8'
                      : 'text/plain;charset=utf-8'
                  )
                }
              >
                {t('app.converter.base.download')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
            {t('app.converter.base.grouped')}
          </CardTitle>
          <CardDescription>{t('app.converter.base.grouped_hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <CopyRow
            label={t('app.converter.base.binary')}
            value={formatWithPrefix(groupedValues.binary, '0b')}
            onCopy={() => void copy(formatWithPrefix(groupedValues.binary, '0b'))}
          />
          <CopyRow
            label={t('app.converter.base.octal')}
            value={formatWithPrefix(groupedValues.octal, '0o')}
            onCopy={() => void copy(formatWithPrefix(groupedValues.octal, '0o'))}
          />
          <CopyRow
            label={t('app.converter.base.decimal')}
            value={groupedValues.decimal}
            onCopy={() => void copy(groupedValues.decimal)}
          />
          <CopyRow
            label={t('app.converter.base.hex')}
            value={formatWithPrefix(groupedValues.hex, '0x')}
            onCopy={() => void copy(formatWithPrefix(groupedValues.hex, '0x'))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

const BaseMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

const CopyRow = ({
  label,
  onCopy,
  value
}: {
  label: string
  onCopy: () => void
  value: string
}) => (
  <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3">
    <div className="min-w-0">
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <code className="mt-1 block truncate font-mono text-sm text-[var(--text-primary)]">
        {value || '-'}
      </code>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-xl"
      disabled={!value}
      onClick={onCopy}
    >
      <Copy className="h-4 w-4" />
    </Button>
  </div>
)

export default BaseClient
