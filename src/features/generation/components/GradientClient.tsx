'use client'

import { ArrowLeftRight, Copy, Dice5, Palette, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type GradientOutput = 'css' | 'react' | 'tailwind' | 'variable'
type GradientType = 'conic' | 'linear' | 'radial'

interface ColorStop {
  color: string
  id: string
  position: number
}

interface GradientPreset {
  angle: number
  nameKey: string
  stops: { color: string; position: number }[]
  type?: GradientType
}

interface GradientStopValue {
  color: string
  position: number
}

const presets: GradientPreset[] = [
  {
    nameKey: 'app.generation.gradient.preset.sunset',
    stops: [
      { color: '#ff6b35', position: 0 },
      { color: '#f7c948', position: 50 },
      { color: '#ff3864', position: 100 }
    ],
    angle: 135
  },
  {
    nameKey: 'app.generation.gradient.preset.ocean',
    stops: [
      { color: '#0077b6', position: 0 },
      { color: '#00b4d8', position: 50 },
      { color: '#90e0ef', position: 100 }
    ],
    angle: 180
  },
  {
    nameKey: 'app.generation.gradient.preset.forest',
    stops: [
      { color: '#2d6a4f', position: 0 },
      { color: '#52b788', position: 50 },
      { color: '#b7e4c7', position: 100 }
    ],
    angle: 160
  },
  {
    nameKey: 'app.generation.gradient.preset.lavender',
    stops: [
      { color: '#7209b7', position: 0 },
      { color: '#b5179e', position: 50 },
      { color: '#f72585', position: 100 }
    ],
    angle: 120
  },
  {
    nameKey: 'app.generation.gradient.preset.midnight',
    stops: [
      { color: '#0f0c29', position: 0 },
      { color: '#302b63', position: 50 },
      { color: '#24243e', position: 100 }
    ],
    angle: 180
  },
  {
    nameKey: 'app.generation.gradient.preset.peach',
    stops: [
      { color: '#ffecd2', position: 0 },
      { color: '#fcb69f', position: 100 }
    ],
    angle: 135
  },
  {
    nameKey: 'app.generation.gradient.preset.signal',
    stops: [
      { color: '#0ea5e9', position: 0 },
      { color: '#22c55e', position: 44 },
      { color: '#facc15', position: 72 },
      { color: '#ef4444', position: 100 }
    ],
    angle: 90,
    type: 'conic'
  }
]

const PALETTE = [
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#6366f1',
  '#64748b',
  '#111827'
]

let stopIdCounter = 0
const createStop = (color: string, position: number): ColorStop => ({
  color,
  id: `stop-${++stopIdCounter}`,
  position
})

const DEFAULT_STOPS = [createStop('#0ea5e9', 0), createStop('#22c55e', 100)]
const MAX_GRADIENT_STOPS = 12

const formatStops = (stops: GradientStopValue[]) =>
  [...stops]
    .sort((a, b) => a.position - b.position)
    .map(stop => `${stop.color} ${stop.position}%`)
    .join(', ')

const buildGradient = (type: GradientType, angle: number, stops: GradientStopValue[]) => {
  const stopsStr = formatStops(stops)
  switch (type) {
    case 'conic':
      return `conic-gradient(from ${angle}deg, ${stopsStr})`
    case 'radial':
      return `radial-gradient(circle at center, ${stopsStr})`
    case 'linear':
      return `linear-gradient(${angle}deg, ${stopsStr})`
  }
}

const getOutput = (outputType: GradientOutput, gradient: string) => {
  switch (outputType) {
    case 'react':
      return JSON.stringify({ background: gradient }, null, 2)
    case 'tailwind':
      return `bg-[${gradient.replaceAll(' ', '_').replaceAll(',', '\\,')}]`
    case 'variable':
      return `--daily-tools-gradient: ${gradient};\n\nbackground: var(--daily-tools-gradient);`
    case 'css':
      return `background: ${gradient};`
  }
}

const getContrastColor = (hex: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff'
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.58 ? '#111827' : '#ffffff'
}

const GradientClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(90)
  const [outputType, setOutputType] = useState<GradientOutput>('css')
  const [stops, setStops] = useState<ColorStop[]>(DEFAULT_STOPS)

  const gradientCSS = useMemo(() => buildGradient(type, angle, stops), [angle, stops, type])
  const outputPreviewSource = useMemo(
    () => getOutput(outputType, gradientCSS),
    [gradientCSS, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(
    () => getOutput(outputType, gradientCSS),
    [gradientCSS, outputType]
  )
  const sortedStops = useMemo(() => [...stops].sort((a, b) => a.position - b.position), [stops])

  const addStop = useCallback(() => {
    setStops(prev => {
      if (prev.length >= MAX_GRADIENT_STOPS) return prev
      const nextPosition = prev.length ? Math.round(100 / (prev.length + 1)) * prev.length : 50
      const nextColor = PALETTE[(prev.length * 3) % PALETTE.length]
      return [...prev, createStop(nextColor, Math.min(100, Math.max(0, nextPosition)))]
    })
  }, [])

  const removeStop = useCallback((id: string) => {
    setStops(prev => (prev.length <= 2 ? prev : prev.filter(stop => stop.id !== id)))
  }, [])

  const updateStopColor = useCallback((id: string, color: string) => {
    setStops(prev => prev.map(stop => (stop.id === id ? { ...stop, color } : stop)))
  }, [])

  const updateStopPosition = useCallback((id: string, position: number) => {
    setStops(prev => prev.map(stop => (stop.id === id ? { ...stop, position } : stop)))
  }, [])

  const applyPreset = useCallback((preset: GradientPreset) => {
    setStops(preset.stops.map(stop => createStop(stop.color, stop.position)))
    setAngle(preset.angle)
    setType(preset.type ?? 'linear')
  }, [])

  const reverseStops = () => {
    setStops(prev =>
      prev.map(stop => ({
        ...stop,
        position: 100 - stop.position
      }))
    )
  }

  const distributeStops = () => {
    setStops(prev => {
      if (prev.length <= 1) return prev
      return [...prev]
        .sort((a, b) => a.position - b.position)
        .map((stop, index, list) => ({
          ...stop,
          position: Math.round((index / (list.length - 1)) * 100)
        }))
    })
  }

  const randomizeStops = () => {
    const count = 3 + Math.floor(Math.random() * 3)
    const picked = [...PALETTE].sort(() => Math.random() - 0.5).slice(0, count)
    setStops(
      picked.map((color, index) =>
        createStop(color, Math.round((index / Math.max(1, picked.length - 1)) * 100))
      )
    )
    setAngle(Math.floor(Math.random() * 361))
    setType((['linear', 'radial', 'conic'] as const)[Math.floor(Math.random() * 3)])
  }

  const resetGradient = () => {
    setType('linear')
    setAngle(90)
    setOutputType('css')
    setStops([createStop('#0ea5e9', 0), createStop('#22c55e', 100)])
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card className="min-h-[300px]">
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className="flex min-h-[300px] items-end rounded-xl p-6"
            style={{ background: gradientCSS }}
          >
            <div
              className="max-w-xs rounded-xl border border-white/30 bg-black/20 p-4 text-sm font-medium shadow-xl backdrop-blur-md"
              style={{ color: getContrastColor(sortedStops[0]?.color ?? '#111827') }}
            >
              {t('app.generation.gradient.preview')}
            </div>
          </div>
          <div className="glass-specular flex flex-col justify-between gap-5 p-6">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.gradient')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.generation.gradient.description')}
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label={t('app.generation.gradient.stop_count')} value={stops.length} />
              <Metric label={t('app.generation.gradient.angle')} value={`${angle}deg`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Dice5 className="h-3.5 w-3.5" />}
                onClick={randomizeStops}
              >
                {t('app.generation.gradient.random')}
              </Button>
              <Button
                size="sm"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => copy(buildCurrentOutput())}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {presets.map(preset => {
          const previewGrad = buildGradient(preset.type ?? 'linear', preset.angle, preset.stops)
          return (
            <button
              key={preset.nameKey}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-panel flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-all hover:-translate-y-0.5 hover:glass-panel-strong"
            >
              <span
                className="h-5 w-5 rounded-full border border-[var(--border-base)]"
                style={{ background: previewGrad }}
              />
              {t(preset.nameKey)}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-[var(--primary)]" />
              {t('app.generation.gradient.settings')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                onClick={reverseStops}
              >
                {t('app.generation.gradient.reverse')}
              </Button>
              <Button size="sm" variant="ghost" onClick={distributeStops}>
                {t('app.generation.gradient.distribute')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={resetGradient}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <Label htmlFor="gradient-type">{t('app.generation.gradient.type')}</Label>
              <Select
                id="gradient-type"
                value={type}
                onChange={event => setType(event.target.value as GradientType)}
              >
                {(['linear', 'radial', 'conic'] as const).map(gradientType => (
                  <option key={gradientType} value={gradientType}>
                    {t(`app.generation.gradient.type.${gradientType}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('app.generation.gradient.angle')}</Label>
                <span className="w-16 text-right font-mono text-sm text-[var(--text-secondary)]">
                  {angle}deg
                </span>
              </div>
              <Slider value={angle} onChange={setAngle} min={0} max={360} />
            </div>

            <div className="space-y-3">
              <Label htmlFor="gradient-output">{t('app.generation.gradient.output_type')}</Label>
              <Select
                id="gradient-output"
                value={outputType}
                onChange={event => setOutputType(event.target.value as GradientOutput)}
              >
                {(['css', 'variable', 'tailwind', 'react'] as const).map(format => (
                  <option key={format} value={format}>
                    {t(`app.generation.gradient.output.${format}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{t('app.generation.gradient.color_stops')}</Label>
              <Button
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={addStop}
                disabled={stops.length >= MAX_GRADIENT_STOPS}
              >
                {t('public.add')}
              </Button>
            </div>
            {sortedStops.map(stop => (
              <div
                key={stop.id}
                className="grid gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3 sm:grid-cols-[180px_minmax(0,1fr)_52px_36px] sm:items-center"
              >
                <ColorPicker
                  value={stop.color}
                  onChange={value => updateStopColor(stop.id, value)}
                />
                <Slider
                  value={stop.position}
                  onChange={value => updateStopPosition(stop.id, value)}
                  min={0}
                  max={100}
                />
                <span className="text-right font-mono text-xs text-[var(--text-secondary)]">
                  {stop.position}%
                </span>
                <button
                  type="button"
                  onClick={() => removeStop(stop.id)}
                  disabled={stops.length <= 2}
                  aria-label={t('public.delete')}
                  className="rounded-md p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error-subtle)] hover:text-[var(--error)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>CSS</CardTitle>
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

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="glass-input rounded-xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

export default GradientClient
