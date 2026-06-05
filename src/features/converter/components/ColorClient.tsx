'use client'

import { ArrowLeftRight, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

interface ColorValues {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`

const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360
  s /= 100
  l /= 100
  let r: number
  let g: number
  let b: number

  if (s === 0) {
    r = l
    g = l
    b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

const clamp = (value: string, max: number) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.min(max, parsed))
}

const ColorClient = () => {
  const { t } = useTranslation()
  const toast = useToast()

  const [colors, setColors] = useState<ColorValues>({
    hex: '#1677ff',
    rgb: { r: 22, g: 119, b: 255 },
    hsl: { h: 215, s: 100, l: 54 }
  })

  const handleHexChange = useCallback((value: string) => {
    const hex = value.startsWith('#') ? value : `#${value}`
    const rgb = hexToRgb(hex)
    if (!rgb) return

    setColors({ hex, rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b) })
  }, [])

  const handleRgbChange = useCallback(
    (key: 'r' | 'g' | 'b', value: string) => {
      const newRgb = { ...colors.rgb, [key]: clamp(value, 255) }
      setColors({
        hex: rgbToHex(newRgb.r, newRgb.g, newRgb.b),
        rgb: newRgb,
        hsl: rgbToHsl(newRgb.r, newRgb.g, newRgb.b)
      })
    },
    [colors.rgb]
  )

  const handleHslChange = useCallback(
    (key: 'h' | 's' | 'l', value: string) => {
      const newHsl = { ...colors.hsl, [key]: clamp(value, key === 'h' ? 360 : 100) }
      const rgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l)
      setColors({ hex: rgbToHex(rgb.r, rgb.g, rgb.b), rgb, hsl: newHsl })
    },
    [colors.hsl]
  )

  const copyToClipboard = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text)
      toast.success(t('app.social.retires.copy_success'))
    },
    [toast, t]
  )

  const hexStr = colors.hex.toUpperCase()
  const rgbStr = `rgb(${colors.rgb.r}, ${colors.rgb.g}, ${colors.rgb.b})`
  const hslStr = `hsl(${colors.hsl.h}, ${colors.hsl.s}%, ${colors.hsl.l}%)`

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden pb-1">
      <Card className="rounded-3xl">
        <CardHeader className="pb-5">
          <CardTitle>{t('app.converter.color')}</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid min-w-0 gap-5 md:grid-cols-[7rem_minmax(0,1fr)] md:items-end">
            <div
              className="h-28 w-full rounded-3xl border border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_34px_rgba(0,0,0,0.10)] md:w-28"
              style={{ backgroundColor: colors.hex }}
              aria-label={hexStr}
            />

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-3">
                <Label htmlFor="color-picker" className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  {t('app.converter.color')}
                </Label>
                <ColorPicker id="color-picker" value={colors.hex} onChange={handleHexChange} />
              </div>

              <div className="grid min-w-0 gap-3">
                <Label htmlFor="color-hex-input">HEX</Label>
                <Input
                  id="color-hex-input"
                  value={colors.hex}
                  onChange={event => handleHexChange(event.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <CardTitle>HEX</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pb-6">
            <Input
              value={colors.hex}
              onChange={event => handleHexChange(event.target.value)}
              className="font-mono"
            />
            <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3">
              <code className="min-w-0 truncate text-sm text-[var(--text-primary)]">{hexStr}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                onClick={() => copyToClipboard(hexStr)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <CardTitle>RGB</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pb-6">
            <div className="grid min-w-0 grid-cols-3 gap-4">
              {(['r', 'g', 'b'] as const).map(key => (
                <div key={key} className="flex min-w-0 flex-col gap-3">
                  <Label htmlFor={`color-rgb-${key}`}>{key.toUpperCase()}</Label>
                  <Input
                    id={`color-rgb-${key}`}
                    type="number"
                    min={0}
                    max={255}
                    value={colors.rgb[key]}
                    onChange={event => handleRgbChange(key, event.target.value)}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3">
              <code className="min-w-0 truncate text-sm text-[var(--text-primary)]">{rgbStr}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                onClick={() => copyToClipboard(rgbStr)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <CardTitle>HSL</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pb-6">
            <div className="grid min-w-0 grid-cols-3 gap-4">
              {(['h', 's', 'l'] as const).map(key => (
                <div key={key} className="flex min-w-0 flex-col gap-3">
                  <Label htmlFor={`color-hsl-${key}`}>{key.toUpperCase()}</Label>
                  <Input
                    id={`color-hsl-${key}`}
                    type="number"
                    min={0}
                    max={key === 'h' ? 360 : 100}
                    value={colors.hsl[key]}
                    onChange={event => handleHslChange(key, event.target.value)}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3">
              <code className="min-w-0 truncate text-sm text-[var(--text-primary)]">{hslStr}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                onClick={() => copyToClipboard(hslStr)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ColorClient
