'use client'

import { ArrowLeftRight, Copy, Hash, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCopy } from '@/hooks/useCopy'

interface BaseValues {
  binary: string
  octal: string
  decimal: string
  hex: string
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BIGINT_ZERO = BigInt(0)
const BIGINT_TWO = BigInt(2)

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

  const updateAllBases = useCallback(
    (value: string, fromBase: number) => {
      if (!value.trim()) {
        setValues({ binary: '', octal: '', decimal: '', hex: '' })
        setError(null)
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

  const handleClear = useCallback(() => {
    setValues({ binary: '', octal: '', decimal: '', hex: '' })
    setError(null)
  }, [])

  const decimalValue = useMemo(() => parseInteger(values.decimal, 10), [values.decimal])
  const integerStats = useMemo(() => {
    if (decimalValue === null) return null

    const magnitude = decimalValue < BIGINT_ZERO ? -decimalValue : decimalValue
    const bitLength = magnitude === BIGINT_ZERO ? 1 : magnitude.toString(2).length
    const byteLength = Math.ceil(bitLength / 8)

    return {
      bitLength,
      byteLength,
      parity:
        magnitude % BIGINT_TWO === BIGINT_ZERO
          ? t('app.converter.base.even')
          : t('app.converter.base.odd')
    }
  }, [decimalValue, t])

  const handleCopyAll = () => {
    const output = [
      `${t('app.converter.base.binary')}: 0b${values.binary}`,
      `${t('app.converter.base.octal')}: 0o${values.octal}`,
      `${t('app.converter.base.decimal')}: ${values.decimal}`,
      `${t('app.converter.base.hex')}: 0x${values.hex}`
    ].join('\n')

    void copy(output)
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
            <div className="grid grid-cols-3 gap-3">
              <BaseMetric
                label={t('app.converter.base.bit_length')}
                value={String(integerStats.bitLength)}
              />
              <BaseMetric
                label={t('app.converter.base.byte_length')}
                value={String(integerStats.byteLength)}
              />
              <BaseMetric label={t('app.converter.base.parity')} value={integerStats.parity} />
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

export default BaseClient
