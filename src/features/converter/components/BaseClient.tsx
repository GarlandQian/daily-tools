'use client'

import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCopy } from '@/hooks/useCopy'

interface BaseValues {
  binary: string
  octal: string
  decimal: string
  hex: string
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

      try {
        // Parse the input value
        const decimal = parseInt(value, fromBase)
        if (isNaN(decimal) || decimal < 0) {
          setError(t('app.converter.base.invalid'))
          return
        }

        setValues({
          binary: decimal.toString(2),
          octal: decimal.toString(8),
          decimal: decimal.toString(10),
          hex: decimal.toString(16).toUpperCase()
        })
        setError(null)
      } catch {
        setError(t('app.converter.base.invalid'))
      }
    },
    [t]
  )

  const handleBinaryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^01]/g, '')
      setValues(prev => ({ ...prev, binary: value }))
      updateAllBases(value, 2)
    },
    [updateAllBases]
  )

  const handleOctalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-7]/g, '')
      setValues(prev => ({ ...prev, octal: value }))
      updateAllBases(value, 8)
    },
    [updateAllBases]
  )

  const handleDecimalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '')
      setValues(prev => ({ ...prev, decimal: value }))
      updateAllBases(value, 10)
    },
    [updateAllBases]
  )

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
      setValues(prev => ({ ...prev, hex: value }))
      updateAllBases(value, 16)
    },
    [updateAllBases]
  )

  const handleClear = useCallback(() => {
    setValues({ binary: '', octal: '', decimal: '', hex: '' })
    setError(null)
  }, [])

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
    <div className="size-full flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('app.converter.base')}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleClear}
            >
              {t('app.format.json.clear')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-secondary)]">{t('app.converter.base.hint')}</p>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
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
                <Button onClick={() => copy(item.value)} disabled={!item.value}>
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

export default BaseClient
