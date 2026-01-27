'use client'

import { Card, Col, Flex, InputNumber, Row, Select, Typography } from 'antd'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolLayout from '@/components/ToolLayout'

type UnitCategory = 'length' | 'weight' | 'temperature' | 'data'

interface UnitDef {
  label: string
  ratio: number // ratio to base unit
}

const unitData: Record<UnitCategory, { base: string; units: Record<string, UnitDef> }> = {
  length: {
    base: 'm',
    units: {
      mm: { label: 'Millimeter (mm)', ratio: 0.001 },
      cm: { label: 'Centimeter (cm)', ratio: 0.01 },
      m: { label: 'Meter (m)', ratio: 1 },
      km: { label: 'Kilometer (km)', ratio: 1000 },
      in: { label: 'Inch (in)', ratio: 0.0254 },
      ft: { label: 'Foot (ft)', ratio: 0.3048 },
      mi: { label: 'Mile (mi)', ratio: 1609.344 }
    }
  },
  weight: {
    base: 'kg',
    units: {
      mg: { label: 'Milligram (mg)', ratio: 0.000001 },
      g: { label: 'Gram (g)', ratio: 0.001 },
      kg: { label: 'Kilogram (kg)', ratio: 1 },
      lb: { label: 'Pound (lb)', ratio: 0.453592 },
      oz: { label: 'Ounce (oz)', ratio: 0.0283495 }
    }
  },
  temperature: {
    base: 'c',
    units: {
      c: { label: 'Celsius (°C)', ratio: 1 },
      f: { label: 'Fahrenheit (°F)', ratio: 1 },
      k: { label: 'Kelvin (K)', ratio: 1 }
    }
  },
  data: {
    base: 'byte',
    units: {
      bit: { label: 'Bit', ratio: 0.125 },
      byte: { label: 'Byte', ratio: 1 },
      kb: { label: 'Kilobyte (KB)', ratio: 1024 },
      mb: { label: 'Megabyte (MB)', ratio: 1024 * 1024 },
      gb: { label: 'Gigabyte (GB)', ratio: 1024 * 1024 * 1024 },
      tb: { label: 'Terabyte (TB)', ratio: 1024 * 1024 * 1024 * 1024 }
    }
  }
}

const UnitClient = () => {
  useTranslation()

  const [category, setCategory] = useState<UnitCategory>('length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('km')
  const [fromValue, setFromValue] = useState<number | null>(1)

  const categoryOptions = [
    { value: 'length', label: 'Length' },
    { value: 'weight', label: 'Weight' },
    { value: 'temperature', label: 'Temperature' },
    { value: 'data', label: 'Data Storage' }
  ]

  const unitOptions = useMemo(() => {
    return Object.entries(unitData[category].units).map(([key, def]) => ({
      value: key,
      label: def.label
    }))
  }, [category])

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
    if (fromValue === null) return null

    if (category === 'temperature') {
      return convertTemperature(fromValue, fromUnit, toUnit)
    }

    const fromRatio = unitData[category].units[fromUnit].ratio
    const toRatio = unitData[category].units[toUnit].ratio
    const baseValue = fromValue * fromRatio
    return baseValue / toRatio
  }, [category, fromUnit, toUnit, fromValue, convertTemperature])

  const handleCategoryChange = (newCategory: UnitCategory) => {
    setCategory(newCategory)
    const units = Object.keys(unitData[newCategory].units)
    setFromUnit(units[0])
    setToUnit(units[1] || units[0])
  }

  return (
    <ToolLayout title="app.converter.unit" showClear onClear={() => setFromValue(1)}>
      <Flex gap={20} vertical>
        <Card>
          <Flex gap={16} wrap>
            <div>
              <Typography.Text type="secondary">Category</Typography.Text>
              <Select
                value={category}
                onChange={handleCategoryChange}
                options={categoryOptions}
                style={{ width: 200, display: 'block' }}
              />
            </div>
          </Flex>
        </Card>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="From">
              <Flex vertical gap={12}>
                <Select
                  value={fromUnit}
                  onChange={setFromUnit}
                  options={unitOptions}
                  style={{ width: '100%' }}
                />
                <InputNumber
                  value={fromValue}
                  onChange={setFromValue}
                  style={{ width: '100%', fontSize: 24 }}
                  size="large"
                />
              </Flex>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="To">
              <Flex vertical gap={12}>
                <Select
                  value={toUnit}
                  onChange={setToUnit}
                  options={unitOptions}
                  style={{ width: '100%' }}
                />
                <Typography.Title level={3} style={{ margin: 0, fontFamily: 'monospace' }}>
                  {result !== null
                    ? result.toLocaleString(undefined, { maximumFractionDigits: 10 })
                    : '-'}
                </Typography.Title>
              </Flex>
            </Card>
          </Col>
        </Row>
      </Flex>
    </ToolLayout>
  )
}

export default UnitClient
