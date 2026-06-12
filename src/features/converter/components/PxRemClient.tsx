'use client'

import { Calculator, Copy, FileCode2, RotateCcw, Type } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

type PxRemOutput = 'css' | 'json' | 'tailwind'
type SpacingPreset = 'compact' | 'default' | 'fluid' | 'tailwind'
type Unit = 'em' | 'percent' | 'px' | 'rem'

const SPACING_PRESETS: Record<SpacingPreset, string> = {
  compact: '2, 4, 6, 8, 10, 12, 16, 20, 24, 32',
  default: '4, 8, 12, 16, 20, 24, 32, 40, 48, 64',
  fluid: '8, 12, 16, 24, 32, 48, 64, 80, 96, 128',
  tailwind: '0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96'
}
const SCALE_INPUT_LIMIT = 12000

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

const parseScale = (input: string) => {
  const values: number[] = []
  let tokenStart = -1

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index]
    const isDelimiter = index === input.length || char === ',' || /\s/u.test(char)

    if (!isDelimiter) {
      if (tokenStart < 0) tokenStart = index
      continue
    }

    if (tokenStart >= 0) {
      const value = Number(input.slice(tokenStart, index))
      if (Number.isFinite(value)) values.push(value)
      tokenStart = -1
      if (values.length >= 80) break
    }
  }

  return values
}

const formatCssVars = (rows: ScaleRow[], prefix: string) =>
  `:root {\n${rows.map(row => `  --${prefix}-${row.name}: ${row.rem}rem;`).join('\n')}\n}`

const formatTailwind = (rows: ScaleRow[], prefix: string) =>
  `spacing: {\n${rows.map(row => `  '${prefix}-${row.name}': '${row.rem}rem',`).join('\n')}\n}`

const formatJson = (rows: ScaleRow[]) =>
  JSON.stringify(
    rows.map(row => ({
      name: row.name,
      px: row.px,
      rem: Number(row.rem),
      percent: Number(row.percent)
    })),
    null,
    2
  )

const buildScaleOutput = (outputType: PxRemOutput, rows: ScaleRow[], tokenPrefix: string) => {
  const prefix = tokenPrefix || 'space'
  if (outputType === 'json') return formatJson(rows)
  if (outputType === 'tailwind') return formatTailwind(rows, prefix)
  return formatCssVars(rows, prefix)
}

interface ScaleRow {
  name: string
  percent: string
  px: number
  rem: string
}

const PxRemClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [value, setValue] = useState(24)
  const [fromUnit, setFromUnit] = useState<Unit>('px')
  const [base, setBase] = useState(16)
  const [scaleInput, setScaleInput] = useState(SPACING_PRESETS.default)
  const [tokenPrefix, setTokenPrefix] = useState('space')
  const [outputType, setOutputType] = useState<PxRemOutput>('css')
  const deferredScaleInput = useDeferredValue(scaleInput)
  const safeScaleInput = useMemo(
    () => deferredScaleInput.slice(0, SCALE_INPUT_LIMIT),
    [deferredScaleInput]
  )
  const scaleInputLimited = scaleInput.length >= SCALE_INPUT_LIMIT

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
      parseScale(safeScaleInput).map((px, index) => ({
        name: String(index + 1).padStart(2, '0'),
        percent: formatNumber((px / base) * 100),
        px,
        rem: formatNumber(px / base)
      })),
    [base, safeScaleInput]
  )
  const outputPreviewSource = useMemo(
    () => buildScaleOutput(outputType, scaleRows, tokenPrefix),
    [outputType, scaleRows, tokenPrefix]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(
    () => buildScaleOutput(outputType, scaleRows, tokenPrefix),
    [outputType, scaleRows, tokenPrefix]
  )

  const conversionSummary = conversions
    .map(item => `${item.value}${item.unit === 'percent' ? '%' : item.unit}`)
    .join('\n')

  const reset = () => {
    setValue(24)
    setFromUnit('px')
    setBase(16)
    setScaleInput(SPACING_PRESETS.default)
    setTokenPrefix('space')
    setOutputType('css')
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
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(conversionSummary)}
              >
                {t('app.converter.px_rem.copy_results')}
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
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.px_rem.scale')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="pxrem-preset">{t('app.converter.px_rem.preset')}</Label>
                <Select
                  id="pxrem-preset"
                  value="custom"
                  onChange={event => {
                    const preset = event.target.value as SpacingPreset | 'custom'
                    if (preset !== 'custom') setScaleInput(SPACING_PRESETS[preset])
                  }}
                >
                  <option value="custom">{t('app.converter.px_rem.preset.custom')}</option>
                  {(['default', 'compact', 'fluid', 'tailwind'] as const).map(preset => (
                    <option key={preset} value={preset}>
                      {t(`app.converter.px_rem.preset.${preset}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="pxrem-prefix">{t('app.converter.px_rem.token_prefix')}</Label>
                <Input
                  id="pxrem-prefix"
                  value={tokenPrefix}
                  onChange={event => setTokenPrefix(event.target.value.replace(/[^\w-]/g, ''))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="pxrem-scale">{t('app.converter.px_rem.scale_input')}</Label>
              <Textarea
                id="pxrem-scale"
                value={scaleInput}
                onChange={event => setScaleInput(event.target.value.slice(0, SCALE_INPUT_LIMIT))}
                rows={3}
                className="resize-none font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                {t('app.converter.px_rem.scale_hint', { count: scaleRows.length })}
              </p>
              {scaleInputLimited ? (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('app.converter.px_rem.scale_input_truncated', {
                    limit: SCALE_INPUT_LIMIT.toLocaleString()
                  })}
                </p>
              ) : null}
            </div>

            <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--glass-panel-bg)]">
                  <tr>
                    <th className="px-3 py-2">{t('app.converter.px_rem.token')}</th>
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
                      <td className="px-3 py-2 font-mono">
                        --{tokenPrefix || 'space'}-{row.name}
                      </td>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.px_rem.output')}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copy(buildCurrentOutput())}>
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-3">
              <Label htmlFor="pxrem-output">{t('app.converter.px_rem.output_type')}</Label>
              <Select
                id="pxrem-output"
                value={outputType}
                onChange={event => setOutputType(event.target.value as PxRemOutput)}
              >
                <option value="css">{t('app.converter.px_rem.output.css')}</option>
                <option value="tailwind">{t('app.converter.px_rem.output.tailwind')}</option>
                <option value="json">{t('app.converter.px_rem.output.json')}</option>
              </Select>
            </div>
            <Textarea
              value={outputPreview}
              readOnly
              rows={16}
              className="min-h-[280px] flex-1 resize-none font-mono"
            />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PxRemClient
