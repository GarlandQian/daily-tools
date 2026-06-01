'use client'

import { Copy, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useCopy } from '@/hooks/useCopy'

interface ShadowConfig {
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  color: string
  opacity: number
  inset: boolean
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
  { key: 'blur' as const, labelKey: 'app.generation.shadow.blur', min: 0, max: 100, suffix: 'px' },
  {
    key: 'spread' as const,
    labelKey: 'app.generation.shadow.spread',
    min: -50,
    max: 50,
    suffix: 'px'
  },
  {
    key: 'opacity' as const,
    labelKey: 'app.generation.shadow.opacity',
    min: 0,
    max: 100,
    suffix: '%'
  }
]

const presetShadows: { nameKey: string; config: ShadowConfig }[] = [
  {
    nameKey: 'app.generation.shadow.preset.subtle',
    config: {
      offsetX: 0,
      offsetY: 2,
      blur: 8,
      spread: 0,
      color: '#000000',
      opacity: 10,
      inset: false
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.medium',
    config: {
      offsetX: 0,
      offsetY: 4,
      blur: 16,
      spread: 0,
      color: '#000000',
      opacity: 20,
      inset: false
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.floating',
    config: {
      offsetX: 0,
      offsetY: 12,
      blur: 32,
      spread: -4,
      color: '#000000',
      opacity: 25,
      inset: false
    }
  },
  {
    nameKey: 'app.generation.shadow.preset.dramatic',
    config: {
      offsetX: 8,
      offsetY: 16,
      blur: 40,
      spread: 4,
      color: '#000000',
      opacity: 35,
      inset: false
    }
  }
]

const defaultConfig: ShadowConfig = {
  offsetX: 5,
  offsetY: 5,
  blur: 15,
  spread: 0,
  color: '#000000',
  opacity: 30,
  inset: false
}

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
}

const ShadowClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [config, setConfig] = useState<ShadowConfig>(defaultConfig)

  const boxShadow = useMemo(() => {
    const { offsetX, offsetY, blur, spread, color, opacity, inset } = config
    const rgba = hexToRgba(color, opacity)
    const insetPrefix = inset ? 'inset ' : ''
    return `${insetPrefix}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${rgba}`
  }, [config])

  const cssOutput = `box-shadow: ${boxShadow};`

  const updateConfig = (key: keyof ShadowConfig, value: number | string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Preview */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-center bg-[var(--bg-muted)] rounded-xl p-12 min-h-[300px]">
            <div
              className="w-32 h-32 rounded-2xl bg-white transition-shadow duration-200"
              style={{ boxShadow }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Presets */}
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

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.shadow.controls')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sliderConfigs.map(({ key, labelKey, min, max, suffix }) => (
              <div key={key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>{t(labelKey)}</Label>
                  <span className="text-sm font-mono text-[var(--text-secondary)]">
                    {config[key]}
                    {suffix}
                  </span>
                </div>
                <Slider
                  value={config[key] as number}
                  min={min}
                  max={max}
                  step={1}
                  onChange={v => updateConfig(key, v)}
                />
              </div>
            ))}

            {/* Color picker */}
            <div className="flex flex-col gap-3">
              <Label>{t('app.generation.shadow.color')}</Label>
              <input
                type="color"
                value={config.color}
                onChange={e => updateConfig('color', e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-lg border border-[var(--border-base)] bg-transparent p-1"
              />
            </div>
          </div>

          {/* Inset checkbox */}
          <Checkbox
            checked={config.inset}
            onChange={e => updateConfig('inset', (e.target as HTMLInputElement).checked)}
            label={t('app.generation.shadow.inset')}
          />
        </CardContent>
      </Card>

      {/* Output */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>CSS</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => setConfig(defaultConfig)}
            >
              {t('public.reset')}
            </Button>
            <Button
              size="sm"
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => copy(cssOutput)}
            >
              {t('public.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="glass-input rounded-lg p-4 font-mono text-sm text-[var(--text-primary)] break-all whitespace-pre-wrap">
            {cssOutput}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ShadowClient
