'use client'

import { ArrowRightLeft, Copy, RotateCcw, Ruler } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

type UnitCategory =
  | 'length'
  | 'area'
  | 'weight'
  | 'temperature'
  | 'volume'
  | 'data'
  | 'speed'
  | 'time'

interface UnitDef {
  ratio: number
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

const UnitClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [category, setCategory] = useState<UnitCategory>('length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('km')
  const [fromValue, setFromValue] = useState<string>('1')

  const unitOptions = useMemo(() => {
    return Object.keys(unitData[category].units).map(key => ({
      value: key,
      label: t(`app.converter.unit.${key}`)
    }))
  }, [category, t])

  const convertTemperature = useCallback((value: number, from: string, to: string): number => {
    // Convert to Celsius first
    let celsius = value
    if (from === 'f') celsius = (value - 32) * (5 / 9)
    else if (from === 'k') celsius = value - 273.15

    // Convert from Celsius to target
    if (to === 'c') return celsius
    if (to === 'f') return celsius * (9 / 5) + 32
    if (to === 'k') return celsius + 273.15
    return celsius
  }, [])

  const result = useMemo(() => {
    const numVal = parseFloat(fromValue)
    if (isNaN(numVal)) return null

    if (category === 'temperature') {
      return convertTemperature(numVal, fromUnit, toUnit)
    }

    const fromRatio = unitData[category].units[fromUnit]?.ratio
    const toRatio = unitData[category].units[toUnit]?.ratio
    if (!fromRatio || !toRatio) return null
    const baseValue = numVal * fromRatio
    return baseValue / toRatio
  }, [category, fromUnit, toUnit, fromValue, convertTemperature])

  const formattedResult = useMemo(() => {
    if (result === null) return '-'

    return result.toLocaleString(undefined, {
      maximumFractionDigits: 10,
      useGrouping: true
    })
  }, [result])

  const handleCategoryChange = (newCategory: UnitCategory) => {
    setCategory(newCategory)
    const units = Object.keys(unitData[newCategory].units)
    setFromUnit(units[0])
    setToUnit(units[1] || units[0])
  }

  const handleSwap = () => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
    // If we have a result, put it as the new fromValue
    if (result !== null) {
      setFromValue(String(result))
    }
  }

  const handleReset = () => {
    setCategory('length')
    setFromUnit('m')
    setToUnit('km')
    setFromValue('1')
  }

  const handleCopyResult = () => {
    if (result === null) return
    void copy(
      `${fromValue} ${t(`app.converter.unit.${fromUnit}`)} = ${formattedResult} ${t(`app.converter.unit.${toUnit}`)}`
    )
  }

  return (
    <div className="flex flex-col gap-5 size-full">
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
            <Button
              type="button"
              variant="outline"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup
            value={category}
            onValueChange={v => handleCategoryChange(v as UnitCategory)}
            className="flex flex-wrap gap-3"
          >
            {(Object.keys(unitData) as UnitCategory[]).map(cat => (
              <label
                key={cat}
                className={`flex items-center gap-2 cursor-pointer select-none px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  category === cat
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'border-[var(--border-base)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <RadioGroupItem value={cat} className="sr-only" />
                {t(`app.converter.unit.category.${cat}`)}
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 flex-1">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.unit.from')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
              {unitOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={fromValue}
              onChange={e => setFromValue(e.target.value)}
              className="font-mono h-14 text-3xl font-semibold"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="icon"
            icon={<ArrowRightLeft className="w-5 h-5" />}
            onClick={handleSwap}
            className="rounded-full"
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
            <Select value={toUnit} onChange={e => setToUnit(e.target.value)}>
              {unitOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <div className="flex items-center h-14 px-3 rounded-lg glass-panel border border-[var(--border-base)]">
              <span className="text-3xl md:text-4xl font-mono font-semibold text-[var(--text-primary)]">
                {formattedResult}
              </span>
            </div>
            {result !== null && (
              <div className="glass-input rounded-lg p-3 text-sm text-[var(--text-secondary)]">
                <span className="font-mono text-[var(--text-primary)]">{fromValue}</span>{' '}
                {t(`app.converter.unit.${fromUnit}`)} ={' '}
                <span className="font-mono text-[var(--text-primary)]">{formattedResult}</span>{' '}
                {t(`app.converter.unit.${toUnit}`)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default UnitClient
