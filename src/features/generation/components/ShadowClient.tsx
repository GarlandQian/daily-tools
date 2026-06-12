'use client'

import { Copy, Layers3, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ColorPicker } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

type ShadowOutput = 'css' | 'react' | 'tailwind' | 'variable'

interface ShadowConfig {
  ambient: boolean
  blur: number
  color: string
  inset: boolean
  offsetX: number
  offsetY: number
  opacity: number
  previewBackground: string
  radius: number
  spread: number
}

const sliderConfigs = [
  {
    key: 'offsetX' as const,
    labelKey: 'app.generation.shadow.offset_x',
    min: -100,
    max: 100,
    suffix: 'px'
  },
  {
    key: 'offsetY' as const,
    labelKey: 'app.generation.shadow.offset_y',
    min: -100,
    max: 100,
    suffix: 'px'
  },
  { key: 'blur' as const, labelKey: 'app.generation.shadow.blur', min: 0, max: 120, suffix: 'px' },
  {
    key: 'spread' as const,
    labelKey: 'app.generation.shadow.spread',
    min: -80,
    max: 80,
    suffix: 'px'
  },
  {
    key: 'opacity' as const,
    labelKey: 'app.generation.shadow.opacity',
    min: 0,
    max: 100,
    suffix: '%'
  },
  {
    key: 'radius' as const,
    labelKey: 'app.generation.shadow.radius',
    min: 0,
    max: 48,
    suffix: 'px'
  }
]

const presetShadows: { nameKey: string; config: ShadowConfig }[] = [
  {
    nameKey: 'app.generation.shadow.preset.subtle',
    config: {
      ambient: true,
      blur: 10,
      color: '#0f172a',
      inset: false,
      offsetX: 0,
      offsetY: 4,
      opacity: 12,
      previewBackground: '#f8fafc',
      radius: 16,
      spread: -2
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.medium',
    config: {
      ambient: true,
      blur: 20,
      color: '#111827',
      inset: false,
      offsetX: 0,
      offsetY: 10,
      opacity: 18,
      previewBackground: '#eef2ff',
      radius: 20,
      spread: -4
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.floating',
    config: {
      ambient: true,
      blur: 38,
      color: '#020617',
      inset: false,
      offsetX: 0,
      offsetY: 18,
      opacity: 24,
      previewBackground: '#ecfeff',
      radius: 24,
      spread: -8
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.dramatic',
    config: {
      ambient: true,
      blur: 54,
      color: '#171717',
      inset: false,
      offsetX: 10,
      offsetY: 26,
      opacity: 34,
      previewBackground: '#fff7ed',
      radius: 28,
      spread: -6
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.inner',
    config: {
      ambient: false,
      blur: 22,
      color: '#0f172a',
      inset: true,
      offsetX: 0,
      offsetY: 3,
      opacity: 24,
      previewBackground: '#f1f5f9',
      radius: 24,
      spread: 0
    }
  }
]

const defaultConfig: ShadowConfig = presetShadows[1].config

const hexToRgb = (hex: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'
  return {
    b: parseInt(normalized.slice(5, 7), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    r: parseInt(normalized.slice(1, 3), 16)
  }
}

const hexToRgba = (hex: string, opacity: number): string => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Number((opacity / 100).toFixed(2))})`
}

const getShadowLayers = (config: ShadowConfig) => {
  const { ambient, blur, color, inset, offsetX, offsetY, opacity, spread } = config
  const mainLayer = `${inset ? 'inset ' : ''}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${hexToRgba(color, opacity)}`

  if (!ambient || inset) return [mainLayer]

  const ambientOpacity = Math.max(4, Math.round(opacity * 0.35))
  const ambientOffset = Math.max(8, Math.round(Math.abs(offsetY) + blur * 0.3))
  const ambientBlur = Math.max(18, Math.round(blur * 1.8))
  const ambientSpread = Math.min(spread, 0) - Math.max(4, Math.round(blur * 0.12))

  return [
    mainLayer,
    `0 ${ambientOffset}px ${ambientBlur}px ${ambientSpread}px ${hexToRgba(color, ambientOpacity)}`
  ]
}

const toReactStyle = (boxShadow: string, radius: number) =>
  JSON.stringify(
    {
      borderRadius: `${radius}px`,
      boxShadow
    },
    null,
    2
  )

const toTailwindShadow = (boxShadow: string, radius: number) => {
  const shadowClass = boxShadow.replaceAll(' ', '_').replaceAll(',', '\\,')
  return `rounded-[${radius}px] shadow-[${shadowClass}]`
}

const getOutput = (outputType: ShadowOutput, boxShadow: string, radius: number) => {
  switch (outputType) {
    case 'react':
      return toReactStyle(boxShadow, radius)
    case 'tailwind':
      return toTailwindShadow(boxShadow, radius)
    case 'variable':
      return `--daily-tools-shadow: ${boxShadow};\n--daily-tools-radius: ${radius}px;\n\nbox-shadow: var(--daily-tools-shadow);\nborder-radius: var(--daily-tools-radius);`
    case 'css':
      return `box-shadow: ${boxShadow};\nborder-radius: ${radius}px;`
  }
}

const ShadowClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [config, setConfig] = useState<ShadowConfig>(defaultConfig)
  const [outputType, setOutputType] = useState<ShadowOutput>('css')

  const shadowLayers = useMemo(() => getShadowLayers(config), [config])
  const boxShadow = shadowLayers.join(', ')
  const outputPreviewSource = useMemo(
    () => getOutput(outputType, boxShadow, config.radius),
    [boxShadow, config.radius, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(
    () => getOutput(outputType, boxShadow, config.radius),
    [boxShadow, config.radius, outputType]
  )

  const updateConfig = (key: keyof ShadowConfig, value: number | string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.shadow')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.generation.shadow.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setConfig(defaultConfig)}
              >
                {t('public.reset')}
              </Button>
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(buildCurrentOutput())}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className="glass-input flex min-h-[320px] items-center justify-center rounded-2xl p-8"
            style={{ background: config.previewBackground }}
          >
            <div
              className="grid h-40 w-40 place-items-center bg-white text-center text-xs font-medium text-slate-500 transition-shadow duration-200"
              style={{
                borderRadius: config.radius,
                boxShadow
              }}
            >
              {t('app.generation.shadow.preview')}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {shadowLayers.map((layer, index) => (
                <div key={layer} className="glass-panel glass-clip rounded-xl p-4">
                  <div className="text-xs text-[var(--text-secondary)]">
                    {t('app.generation.shadow.layer')} {index + 1}
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-[var(--text-primary)]">
                    {layer}
                  </div>
                </div>
              ))}
              <div className="glass-panel glass-clip rounded-xl p-4">
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('app.generation.shadow.output_type')}
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.shadow.output.${outputType}`)}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-xl p-4">
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('app.generation.shadow.radius')}
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-[var(--text-primary)]">
                  {config.radius}px
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="shadow-output-type">{t('app.generation.shadow.output_type')}</Label>
              <Select
                id="shadow-output-type"
                value={outputType}
                onChange={event => setOutputType(event.target.value as ShadowOutput)}
              >
                {(['css', 'variable', 'tailwind', 'react'] as const).map(type => (
                  <option key={type} value={type}>
                    {t(`app.generation.shadow.output.${type}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <Label>{t('app.generation.shadow.color')}</Label>
                <ColorPicker
                  value={config.color}
                  onChange={value => updateConfig('color', value)}
                />
              </div>
              <div className="space-y-3">
                <Label>{t('app.generation.shadow.preview_background')}</Label>
                <ColorPicker
                  value={config.previewBackground}
                  onChange={value => updateConfig('previewBackground', value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {presetShadows.map(preset => (
          <Button
            key={preset.nameKey}
            size="sm"
            variant="default"
            onClick={() => setConfig(preset.config)}
          >
            {t(preset.nameKey)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[var(--primary)]" />
            {t('app.generation.shadow.controls')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sliderConfigs.map(({ key, labelKey, min, max, suffix }) => (
              <div key={key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t(labelKey)}</Label>
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {config[key]}
                    {suffix}
                  </span>
                </div>
                <Slider
                  value={config[key] as number}
                  min={min}
                  max={max}
                  step={1}
                  onChange={value => updateConfig(key, value)}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-5">
            <Checkbox
              checked={config.inset}
              onChange={event => updateConfig('inset', (event.target as HTMLInputElement).checked)}
              label={t('app.generation.shadow.inset')}
            />
            <Checkbox
              checked={config.ambient}
              disabled={config.inset}
              onChange={event =>
                updateConfig('ambient', (event.target as HTMLInputElement).checked)
              }
              label={t('app.generation.shadow.ambient')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{t('app.generation.shadow.code')}</CardTitle>
          <Button
            size="sm"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => copy(buildCurrentOutput())}
          >
            {t('public.copy')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="glass-input whitespace-pre-wrap break-all rounded-lg p-4 font-mono text-sm text-[var(--text-primary)]">
            {outputPreview}
          </div>
          {outputPreviewLimited ? (
            <p className="mt-3 text-xs leading-5 text-amber-600 dark:text-amber-300">
              {t('public.output_preview_limited', {
                total: outputPreviewSource.length.toLocaleString(),
                visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShadowClient
