'use client'

import { Copy, FileCode2, RefreshCw, Ruler, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

type ClampProperty = 'font-size' | 'gap' | 'margin' | 'padding' | 'width'
type ClampUnit = 'px' | 'rem'

interface ClampFormData {
  maxSize: number
  maxViewport: number
  minSize: number
  minViewport: number
  property: ClampProperty
  rootSize: number
  tokenName: string
  unit: ClampUnit
}

interface ClampPreset {
  key: string
  value: ClampFormData
}

const DEFAULT_FORM_DATA: ClampFormData = {
  maxSize: 32,
  maxViewport: 1440,
  minSize: 16,
  minViewport: 375,
  property: 'font-size',
  rootSize: 16,
  tokenName: 'fluid-type',
  unit: 'rem'
}

const CLAMP_PRESETS: ClampPreset[] = [
  {
    key: 'body',
    value: {
      ...DEFAULT_FORM_DATA,
      maxSize: 18,
      minSize: 15,
      property: 'font-size',
      tokenName: 'body-size'
    }
  },
  {
    key: 'heading',
    value: {
      ...DEFAULT_FORM_DATA,
      maxSize: 56,
      minSize: 28,
      property: 'font-size',
      tokenName: 'heading-size'
    }
  },
  {
    key: 'space',
    value: {
      ...DEFAULT_FORM_DATA,
      maxSize: 48,
      maxViewport: 1280,
      minSize: 16,
      property: 'gap',
      tokenName: 'fluid-space'
    }
  },
  {
    key: 'container',
    value: {
      ...DEFAULT_FORM_DATA,
      maxSize: 960,
      maxViewport: 1440,
      minSize: 320,
      property: 'width',
      tokenName: 'content-width',
      unit: 'px'
    }
  }
]

const SAMPLE_VIEWPORTS = [320, 375, 768, 1024, 1280, 1440]

const round = (value: number) => Number(value.toFixed(4))

const formatValue = (px: number, rootSize: number, unit: ClampUnit) => {
  if (unit === 'px') return `${round(px)}px`
  return `${round(px / rootSize)}rem`
}

const getFluidPx = (
  viewport: number,
  minViewport: number,
  maxViewport: number,
  minSize: number,
  maxSize: number
) => {
  if (viewport <= minViewport) return minSize
  if (viewport >= maxViewport) return maxSize
  const progress = (viewport - minViewport) / (maxViewport - minViewport)
  return minSize + (maxSize - minSize) * progress
}

const ClampClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<ClampFormData>(DEFAULT_FORM_DATA)

  const result = useMemo(() => {
    const viewportRange = formData.maxViewport - formData.minViewport

    if (
      viewportRange <= 0 ||
      formData.rootSize <= 0 ||
      formData.minSize < 0 ||
      formData.maxSize < 0
    ) {
      return null
    }

    const slope = (formData.maxSize - formData.minSize) / viewportRange
    const intercept = formData.minSize - slope * formData.minViewport
    const preferred = `${formatValue(intercept, formData.rootSize, formData.unit)} + ${round(slope * 100)}vw`
    const css = `clamp(${formatValue(formData.minSize, formData.rootSize, formData.unit)}, ${preferred}, ${formatValue(
      formData.maxSize,
      formData.rootSize,
      formData.unit
    )})`
    const tailwind = `${formData.property === 'font-size' ? 'text' : formData.property}-[${css.replaceAll(' ', '_')}]`
    const declaration = `${formData.property}: ${css};`
    const variable = `--${formData.tokenName || 'fluid-value'}: ${css};\n${formData.property}: var(--${formData.tokenName || 'fluid-value'});`
    const samples = SAMPLE_VIEWPORTS.map(viewport => ({
      viewport,
      value: formatValue(
        getFluidPx(
          viewport,
          formData.minViewport,
          formData.maxViewport,
          formData.minSize,
          formData.maxSize
        ),
        formData.rootSize,
        formData.unit
      )
    }))

    return {
      css,
      declaration,
      intercept: round(intercept),
      samples,
      slope: round(slope),
      tailwind,
      variable
    }
  }, [formData])

  const updateNumber = useCallback((key: keyof ClampFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: Number(value)
    }))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
  }, [])

  const fullOutput = result
    ? `${result.declaration}\n\n${result.variable}\n\n${result.tailwind}`
    : t('app.generation.clamp.invalid')

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('app.generation.clamp')}</CardTitle>
              <CardDescription>{t('app.generation.clamp.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
              <Button
                type="button"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(fullOutput)}
                disabled={!result}
              >
                {t('app.generation.clamp.copy_all')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3">
              <Label htmlFor="clamp-property">{t('app.generation.clamp.property')}</Label>
              <Select
                id="clamp-property"
                value={formData.property}
                onChange={event =>
                  setFormData(prev => ({
                    ...prev,
                    property: event.target.value as ClampProperty
                  }))
                }
              >
                {(['font-size', 'gap', 'padding', 'margin', 'width'] as const).map(property => (
                  <option key={property} value={property}>
                    {t(`app.generation.clamp.property.${property}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-unit">{t('app.generation.clamp.output_unit')}</Label>
              <Select
                id="clamp-unit"
                value={formData.unit}
                onChange={event =>
                  setFormData(prev => ({
                    ...prev,
                    unit: event.target.value as ClampUnit
                  }))
                }
              >
                <option value="rem">rem</option>
                <option value="px">px</option>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-token">{t('app.generation.clamp.token_name')}</Label>
              <Input
                id="clamp-token"
                value={formData.tokenName}
                onChange={event =>
                  setFormData(prev => ({
                    ...prev,
                    tokenName: event.target.value.replace(/[^\w-]/g, '')
                  }))
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-root">{t('app.generation.clamp.root_size')}</Label>
              <Input
                id="clamp-root"
                type="number"
                min={1}
                value={formData.rootSize}
                onChange={event => updateNumber('rootSize', event.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <NumberField
              id="clamp-min-size"
              label={t('app.generation.clamp.min_size')}
              value={formData.minSize}
              onChange={value => updateNumber('minSize', value)}
            />
            <NumberField
              id="clamp-max-size"
              label={t('app.generation.clamp.max_size')}
              value={formData.maxSize}
              onChange={value => updateNumber('maxSize', value)}
            />
            <NumberField
              id="clamp-min-vw"
              label={t('app.generation.clamp.min_viewport')}
              value={formData.minViewport}
              onChange={value => updateNumber('minViewport', value)}
            />
            <NumberField
              id="clamp-max-vw"
              label={t('app.generation.clamp.max_viewport')}
              value={formData.maxViewport}
              onChange={value => updateNumber('maxViewport', value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CLAMP_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => setFormData(preset.value)}
              >
                {t(`app.generation.clamp.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
              {t('app.generation.clamp.result')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <>
                <CopyRow
                  copyLabel={t('public.copy')}
                  label={t('app.generation.clamp.css_value')}
                  value={result.css}
                  onCopy={() => copy(result.css)}
                />
                <CopyRow
                  copyLabel={t('public.copy')}
                  label={t('app.generation.clamp.declaration')}
                  value={result.declaration}
                  onCopy={() => copy(result.declaration)}
                />
                <CopyRow
                  copyLabel={t('public.copy')}
                  label={t('app.generation.clamp.variable')}
                  value={result.variable}
                  onCopy={() => copy(result.variable)}
                />
                <CopyRow
                  copyLabel={t('public.copy')}
                  label={t('app.generation.clamp.tailwind_value')}
                  value={result.tailwind}
                  onCopy={() => copy(result.tailwind)}
                />
              </>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[var(--error)] bg-[var(--error-subtle)] p-6 text-center text-sm text-[var(--text-primary)]">
                {t('app.generation.clamp.invalid')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.clamp.preview')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="glass-panel glass-clip rounded-3xl p-5">
              <div
                className="font-semibold leading-tight text-[var(--text-primary)]"
                style={
                  result
                    ? formData.property === 'font-size'
                      ? { fontSize: result.css }
                      : { [formData.property]: result.css }
                    : undefined
                }
              >
                Daily Tools
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.clamp.preview_description')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Metric
                icon={<Ruler className="h-4 w-4" />}
                label={t('app.generation.clamp.slope')}
                value={result?.slope ?? '-'}
              />
              <Metric
                label={t('app.generation.clamp.intercept')}
                value={result?.intercept ?? '-'}
              />
            </div>

            {result && (
              <div className="glass-clip overflow-hidden rounded-xl border border-[var(--border-base)]">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-[var(--glass-panel-bg)]">
                    <tr>
                      <th className="px-3 py-2">{t('app.generation.clamp.viewport')}</th>
                      <th className="px-3 py-2">{t('app.generation.clamp.sample_value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.samples.map(sample => (
                      <tr key={sample.viewport} className="border-t border-[var(--border-base)]">
                        <td className="px-3 py-2 font-mono">{sample.viewport}px</td>
                        <td className="px-3 py-2 font-mono">{sample.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const NumberField = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: number
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      min={0}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="font-mono"
    />
  </div>
)

const CopyRow = ({
  label,
  copyLabel,
  onCopy,
  value
}: {
  copyLabel: string
  label: string
  onCopy: () => void
  value: string
}) => (
  <div className="space-y-3">
    <Label>{label}</Label>
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm text-[var(--text-primary)]">
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-xl"
        icon={<Copy className="h-4 w-4" />}
        onClick={onCopy}
        aria-label={copyLabel}
      />
    </div>
  </div>
)

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

export default ClampClient
