'use client'

import { Copy, Palette, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Slider } from '@/components/ui/slider'
import { useCopy } from '@/hooks/useCopy'

type GradientType = 'linear' | 'radial'

interface ColorStop {
  id: string
  color: string
  position: number
}

const presets: { nameKey: string; stops: { color: string; position: number }[]; angle: number }[] =
  [
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
    }
  ]

let stopIdCounter = 0
const createStop = (color: string, position: number): ColorStop => ({
  id: `stop-${++stopIdCounter}`,
  color,
  position
})

const GradientClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(90)
  const [stops, setStops] = useState<ColorStop[]>([
    createStop('#667eea', 0),
    createStop('#764ba2', 100)
  ])

  const gradientCSS = useMemo(() => {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position)
    const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ')
    if (type === 'linear') {
      return `linear-gradient(${angle}deg, ${stopsStr})`
    }
    return `radial-gradient(circle, ${stopsStr})`
  }, [type, angle, stops])

  const fullCSS = `background: ${gradientCSS};`

  const addStop = useCallback(() => {
    const newPosition = 50
    const newColor = '#ffffff'
    setStops(prev => [...prev, createStop(newColor, newPosition)])
  }, [])

  const removeStop = useCallback((id: string) => {
    setStops(prev => (prev.length <= 2 ? prev : prev.filter(s => s.id !== id)))
  }, [])

  const updateStopColor = useCallback((id: string, color: string) => {
    setStops(prev => prev.map(s => (s.id === id ? { ...s, color } : s)))
  }, [])

  const updateStopPosition = useCallback((id: string, position: number) => {
    setStops(prev => prev.map(s => (s.id === id ? { ...s, position } : s)))
  }, [])

  const applyPreset = useCallback((preset: (typeof presets)[number]) => {
    setStops(preset.stops.map(s => createStop(s.color, s.position)))
    setAngle(preset.angle)
    setType('linear')
  }, [])

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Live Preview */}
      <Card className="flex-1 min-h-[240px]">
        <CardContent className="p-0 h-full">
          <div
            className="w-full h-full min-h-[240px] rounded-xl"
            style={{ background: gradientCSS }}
          />
        </CardContent>
      </Card>

      {/* Presets */}
      <div className="flex flex-wrap gap-3">
        {presets.map(preset => {
          const previewGrad = `linear-gradient(${preset.angle}deg, ${preset.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`
          return (
            <button
              key={preset.nameKey}
              onClick={() => applyPreset(preset)}
              className="glass-panel rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center gap-2"
            >
              <div
                className="w-5 h-5 rounded-full border border-[var(--border-base)]"
                style={{ background: previewGrad }}
              />
              {t(preset.nameKey)}
            </button>
          )
        })}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {t('app.generation.gradient.settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Type toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="w-20 text-sm text-[var(--text-secondary)]">
              {t('app.generation.gradient.type')}
            </span>
            <div className="flex gap-1">
              {(['linear', 'radial'] as const).map(gradientType => (
                <button
                  key={gradientType}
                  onClick={() => setType(gradientType)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    type === gradientType
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'glass-input text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {t(`app.generation.gradient.type.${gradientType}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Angle slider */}
          {type === 'linear' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="w-20 text-sm text-[var(--text-secondary)]">
                {t('app.generation.gradient.angle')}
              </span>
              <div className="flex-1">
                <Slider value={angle} onChange={setAngle} min={0} max={360} />
              </div>
              <span className="text-sm font-mono text-[var(--text-secondary)] w-12 text-right">
                {angle}deg
              </span>
            </div>
          )}

          {/* Color stops */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.generation.gradient.color_stops')}
              </span>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addStop}>
                {t('public.add')}
              </Button>
            </div>
            {stops.map(stop => (
              <div
                key={stop.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <ColorPicker
                  value={stop.color}
                  onChange={value => updateStopColor(stop.id, value)}
                  className="shrink-0 sm:w-44"
                />
                <div className="flex-1">
                  <Slider
                    value={stop.position}
                    onChange={v => updateStopPosition(stop.id, v)}
                    min={0}
                    max={100}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--text-secondary)] w-10 text-right">
                  {stop.position}%
                </span>
                <button
                  onClick={() => removeStop(stop.id)}
                  disabled={stops.length <= 2}
                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generated CSS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>CSS</CardTitle>
          <Button size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={() => copy(fullCSS)}>
            {t('public.copy')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="glass-input rounded-lg p-4 font-mono text-sm text-[var(--text-primary)] break-all whitespace-pre-wrap">
            {fullCSS}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default GradientClient
