'use client'

import { ArrowRightLeft, Copy, ListChecks, RotateCcw, Ruler } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

type UnitCategory =
  | 'area'
  | 'data'
  | 'length'
  | 'speed'
  | 'temperature'
  | 'time'
  | 'volume'
  | 'weight'

interface UnitDef {
  ratio: number
}

interface UnitPreset {
  category: UnitCategory
  fromUnit: string
  labelKey: string
  toUnit: string
  value: string
}

const unitData: Record<UnitCategory, { base: string; units: Record<string, UnitDef> }> = {
  length: {
    base: 'm',
    units: {
      mm: { ratio: 0.001 },
      cm: { ratio: 0.01 },
      m: { ratio: 1 },
      km: { ratio: 1000 },
      in: { ratio: 0.0254 },
      ft: { ratio: 0.3048 },
      mi: { ratio: 1609.344 }
    }
  },
  area: {
    base: 'm2',
    units: {
      mm2: { ratio: 0.000001 },
      cm2: { ratio: 0.0001 },
      m2: { ratio: 1 },
      km2: { ratio: 1000000 },
      ft2: { ratio: 0.09290304 },
      acre: { ratio: 4046.8564224 },
      ha: { ratio: 10000 }
    }
  },
  weight: {
    base: 'kg',
    units: {
      mg: { ratio: 0.000001 },
      g: { ratio: 0.001 },
      kg: { ratio: 1 },
      lb: { ratio: 0.453592 },
      oz: { ratio: 0.0283495 }
    }
  },
  temperature: {
    base: 'c',
    units: {
      c: { ratio: 1 },
      f: { ratio: 1 },
      k: { ratio: 1 }
    }
  },
  volume: {
    base: 'l',
    units: {
      ml: { ratio: 0.001 },
      l: { ratio: 1 },
      m3: { ratio: 1000 },
      tsp: { ratio: 0.00492892159375 },
      tbsp: { ratio: 0.01478676478125 },
      cup: { ratio: 0.2365882365 },
      floz: { ratio: 0.0295735295625 },
      gal: { ratio: 3.785411784 }
    }
  },
  data: {
    base: 'byte',
    units: {
      bit: { ratio: 0.125 },
      byte: { ratio: 1 },
      kb: { ratio: 1024 },
      mb: { ratio: 1024 * 1024 },
      gb: { ratio: 1024 * 1024 * 1024 },
      tb: { ratio: 1024 * 1024 * 1024 * 1024 }
    }
  },
  speed: {
    base: 'mps',
    units: {
      mps: { ratio: 1 },
      kph: { ratio: 0.2777777777777778 },
      mph: { ratio: 0.44704 },
      knot: { ratio: 0.5144444444444445 },
      fps: { ratio: 0.3048 }
    }
  },
  time: {
    base: 's',
    units: {
      ms: { ratio: 0.001 },
      s: { ratio: 1 },
      min: { ratio: 60 },
      h: { ratio: 3600 },
      day: { ratio: 86400 },
      week: { ratio: 604800 }
    }
  }
}

const UNIT_CATEGORIES = Object.keys(unitData) as UnitCategory[]
const UNIT_VALUE_LIMIT = 40

const PRESETS: UnitPreset[] = [
  {
    category: 'length',
    fromUnit: 'm',
    labelKey: 'app.converter.unit.preset.room',
    toUnit: 'ft',
    value: '3.6'
  },
  {
    category: 'weight',
    fromUnit: 'kg',
    labelKey: 'app.converter.unit.preset.shipping',
    toUnit: 'lb',
    value: '2.5'
  },
  {
    category: 'temperature',
    fromUnit: 'c',
    labelKey: 'app.converter.unit.preset.weather',
    toUnit: 'f',
    value: '25'
  },
  {
    category: 'data',
    fromUnit: 'mb',
    labelKey: 'app.converter.unit.preset.asset',
    toUnit: 'gb',
    value: '512'
  }
]

const convertTemperature = (value: number, from: string, to: string): number => {
  let celsius = value
  if (from === 'f') celsius = (value - 32) * (5 / 9)
  else if (from === 'k') celsius = value - 273.15

  if (to === 'c') return celsius
  if (to === 'f') return celsius * (9 / 5) + 32
  if (to === 'k') return celsius + 273.15
  return celsius
}

const convertUnit = (value: number, category: UnitCategory, fromUnit: string, toUnit: string) => {
  if (category === 'temperature') return convertTemperature(value, fromUnit, toUnit)

  const fromRatio = unitData[category].units[fromUnit]?.ratio
  const toRatio = unitData[category].units[toUnit]?.ratio
  if (!fromRatio || !toRatio) return null
  const baseValue = value * fromRatio
  return baseValue / toRatio
}

const createFormatter = (digits: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    useGrouping: true
  })

const formatResult = (value: number, digits: number) => {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  if (abs > 0 && (abs < 0.000001 || abs >= 1e12)) return value.toExponential(Math.min(digits, 8))
  return createFormatter(digits).format(value)
}

const UnitClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [category, setCategory] = useState<UnitCategory>('length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('km')
  const [fromValue, setFromValue] = useState<string>('1')
  const [precision, setPrecision] = useState(6)

  const unitOptions = useMemo(() => {
    return Object.keys(unitData[category].units).map(key => ({
      label: t(`app.converter.unit.${key}`),
      value: key
    }))
  }, [category, t])

  const numericValue = Number(fromValue)
  const result = useMemo(() => {
    if (!Number.isFinite(numericValue)) return null
    return convertUnit(numericValue, category, fromUnit, toUnit)
  }, [category, fromUnit, numericValue, toUnit])

  const allResults = useMemo(() => {
    if (!Number.isFinite(numericValue)) return []

    return Object.keys(unitData[category].units).map(unit => {
      const value = convertUnit(numericValue, category, fromUnit, unit)
      return {
        formatted: value === null ? '-' : formatResult(value, precision),
        unit,
        value
      }
    })
  }, [category, fromUnit, numericValue, precision])

  const formattedResult = result === null ? '-' : formatResult(result, precision)

  const handleCategoryChange = (newCategory: UnitCategory) => {
    setCategory(newCategory)
    const units = Object.keys(unitData[newCategory].units)
    setFromUnit(units[0])
    setToUnit(units[1] || units[0])
  }

  const handleSwap = () => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
    if (result !== null) setFromValue(String(result).slice(0, UNIT_VALUE_LIMIT))
  }

  const handleReset = () => {
    setCategory('length')
    setFromUnit('m')
    setToUnit('km')
    setFromValue('1')
    setPrecision(6)
  }

  const applyPreset = (preset: UnitPreset) => {
    setCategory(preset.category)
    setFromUnit(preset.fromUnit)
    setToUnit(preset.toUnit)
    setFromValue(preset.value.slice(0, UNIT_VALUE_LIMIT))
  }

  const handleCopyResult = () => {
    if (result === null) return
    void copy(
      `${fromValue} ${t(`app.converter.unit.${fromUnit}`)} = ${formattedResult} ${t(`app.converter.unit.${toUnit}`)}`
    )
  }

  const handleCopyAll = () => {
    if (!allResults.length) return
    void copy(
      allResults.map(item => `${item.formatted} ${t(`app.converter.unit.${item.unit}`)}`).join('\n')
    )
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.unit')}
              </CardTitle>
              <CardDescription>{t('app.converter.unit.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
              <Button
                type="button"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleCopyAll}
                disabled={!allResults.length}
              >
                {t('app.converter.unit.copy_all')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <RadioGroup
            value={category}
            onValueChange={value => handleCategoryChange(value as UnitCategory)}
            className="flex flex-wrap gap-3"
          >
            {UNIT_CATEGORIES.map(cat => (
              <label
                key={cat}
                className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  category === cat
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                    : 'border-[var(--border-base)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <RadioGroupItem value={cat} className="sr-only" />
                {t(`app.converter.unit.category.${cat}`)}
              </label>
            ))}
          </RadioGroup>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <Button
                key={preset.labelKey}
                size="sm"
                variant="default"
                onClick={() => applyPreset(preset)}
              >
                {t(preset.labelKey)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.unit.from')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={fromUnit} onChange={event => setFromUnit(event.target.value)}>
              {unitOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={fromValue}
              onChange={event => setFromValue(event.target.value.slice(0, UNIT_VALUE_LIMIT))}
              className="h-14 font-mono text-3xl font-semibold"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="icon"
            icon={<ArrowRightLeft className="h-5 w-5" />}
            onClick={handleSwap}
            className="rounded-full"
            aria-label={t('public.swap')}
          />
        </div>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.converter.unit.to')}</CardTitle>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleCopyResult}
                disabled={result === null}
              >
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={toUnit} onChange={event => setToUnit(event.target.value)}>
              {unitOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div className="glass-panel flex min-h-14 items-center rounded-lg border border-[var(--border-base)] px-3">
              <span className="break-all font-mono text-3xl font-semibold text-[var(--text-primary)] md:text-4xl">
                {formattedResult}
              </span>
            </div>
            <div className="glass-input rounded-lg p-3 text-sm text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--text-primary)]">{fromValue || '-'}</span>{' '}
              {t(`app.converter.unit.${fromUnit}`)} ={' '}
              <span className="font-mono text-[var(--text-primary)]">{formattedResult}</span>{' '}
              {t(`app.converter.unit.${toUnit}`)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.unit.all_results')}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Label htmlFor="unit-precision" className="text-xs">
                {t('app.converter.unit.precision')}
              </Label>
              <Select
                id="unit-precision"
                value={String(precision)}
                onChange={event => setPrecision(Number(event.target.value))}
                className="w-28"
              >
                {[2, 4, 6, 8, 10].map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--glass-panel-bg)]">
                <tr>
                  <th className="px-3 py-2">{t('app.converter.unit.unit')}</th>
                  <th className="px-3 py-2">{t('app.converter.unit.value')}</th>
                  <th className="px-3 py-2">{t('public.copy')}</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map(item => (
                  <tr key={item.unit} className="border-t border-[var(--border-base)]">
                    <td className="px-3 py-2">{t(`app.converter.unit.${item.unit}`)}</td>
                    <td className="px-3 py-2 font-mono">{item.formatted}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copy(`${item.formatted} ${t(`app.converter.unit.${item.unit}`)}`)
                        }
                      >
                        {t('public.copy')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default UnitClient
