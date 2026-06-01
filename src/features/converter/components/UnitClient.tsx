'use client'

import { ArrowRightLeft } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'

type UnitCategory = 'length' | 'weight' | 'temperature' | 'data'

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
  }
}

const UnitClient = () => {
  const { t } = useTranslation()

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

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Category pills */}
      <Card>
        <CardContent className="p-4">
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

      {/* From / To columns */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 flex-1">
        {/* From */}
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

        {/* Swap button */}
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="icon"
            icon={<ArrowRightLeft className="w-5 h-5" />}
            onClick={handleSwap}
            className="rounded-full"
          />
        </div>

        {/* To */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.unit.to')}</CardTitle>
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
                {result !== null
                  ? result.toLocaleString(undefined, { maximumFractionDigits: 10 })
                  : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default UnitClient
