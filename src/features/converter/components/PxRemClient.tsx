'use client'

import { Calculator, Copy, RotateCcw, Type } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type Unit = 'px' | 'rem' | 'em' | 'percent'

const toPx = (value: number, unit: Unit, base: number) => {
  if (unit === 'px') return value
  if (unit === 'percent') return (value / 100) * base
  return value * base
}

const fromPx = (px: number, unit: Unit, base: number) => {
  if (unit === 'px') return px
  if (unit === 'percent') return (px / base) * 100
  return px / base
}

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(4)).toString()
}

const PxRemClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [value, setValue] = useState(24)
  const [fromUnit, setFromUnit] = useState<Unit>('px')
  const [base, setBase] = useState(16)
  const [scaleInput, setScaleInput] = useState('4, 8, 12, 16, 20, 24, 32, 40, 48, 64')

  const pxValue = useMemo(() => toPx(value, fromUnit, base), [base, fromUnit, value])
  const conversions = useMemo(
    () =>
      (['px', 'rem', 'em', 'percent'] as const).map(unit => ({
        unit,
        value: formatNumber(fromPx(pxValue, unit, base))
      })),
    [base, pxValue]
  )
  const scaleRows = useMemo(
    () =>
      scaleInput
        .split(/[,\s]+/)
        .map(item => Number(item))
        .filter(item => Number.isFinite(item))
        .map(px => ({
          px,
          rem: formatNumber(px / base),
          percent: formatNumber((px / base) * 100)
        })),
    [base, scaleInput]
  )
  const cssVars = scaleRows.map((row, index) => `  --space-${index + 1}: ${row.rem}rem;`).join('\n')

  const reset = () => {
    setValue(24)
    setFromUnit('px')
    setBase(16)
    setScaleInput('4, 8, 12, 16, 20, 24, 32, 40, 48, 64')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.px_rem')}
              </CardTitle>
              <CardDescription>{t('app.converter.px_rem.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() =>
                  copy(conversions.map(item => `${item.value}${item.unit}`).join('\n'))
                }
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="space-y-3">
              <Label htmlFor="pxrem-value">{t('app.converter.px_rem.value')}</Label>
              <Input
                id="pxrem-value"
                type="number"
                value={value}
                onChange={event => setValue(Number(event.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="pxrem-unit">{t('app.converter.px_rem.from')}</Label>
              <Select
                id="pxrem-unit"
                value={fromUnit}
                onChange={event => setFromUnit(event.target.value as Unit)}
              >
                {(['px', 'rem', 'em', 'percent'] as const).map(unit => (
                  <option key={unit} value={unit}>
                    {unit === 'percent' ? '%' : unit}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="pxrem-base">{t('app.converter.px_rem.base')}</Label>
              <Input
                id="pxrem-base"
                type="number"
                min={1}
                value={base}
                onChange={event => setBase(Math.max(1, Number(event.target.value)))}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.px_rem.results')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {conversions.map(item => (
                <div key={item.unit} className="glass-input rounded-xl p-4">
                  <p className="text-xs uppercase text-[var(--text-tertiary)]">
                    {item.unit === 'percent' ? '%' : item.unit}
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-[var(--text-primary)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Label htmlFor="pxrem-scale">{t('app.converter.px_rem.scale')}</Label>
              <Textarea
                id="pxrem-scale"
                value={scaleInput}
                onChange={event => setScaleInput(event.target.value)}
                rows={3}
                className="resize-none font-mono"
              />
            </div>

            <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--glass-panel-bg)]">
                  <tr>
                    <th className="px-3 py-2">px</th>
                    <th className="px-3 py-2">rem</th>
                    <th className="px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {scaleRows.map(row => (
                    <tr
                      key={`${row.px}-${row.rem}`}
                      className="border-t border-[var(--border-base)]"
                    >
                      <td className="px-3 py-2 font-mono">{row.px}</td>
                      <td className="px-3 py-2 font-mono">{row.rem}</td>
                      <td className="px-3 py-2 font-mono">{row.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.converter.px_rem.css_vars')}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copy(`:root {\n${cssVars}\n}`)}>
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={`:root {\n${cssVars}\n}`}
              readOnly
              rows={16}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PxRemClient
