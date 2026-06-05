'use client'

import { ArrowLeftRight, CheckCircle2, Copy, Palette, RotateCcw, ShieldCheck } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCopy } from '@/hooks/useCopy'

interface RgbValue {
  r: number
  g: number
  b: number
}

interface HslValue {
  h: number
  s: number
  l: number
}

interface ColorValues {
  hex: string
  rgb: RgbValue
  hsl: HslValue
}

interface Swatch {
  label: string
  value: string
}

const DEFAULT_COLOR = '#1677ff'
const DEFAULT_BACKGROUND = '#ffffff'

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

const normalizeHex = (value: string) => {
  const compact = value.trim().replace(/^#/, '')

  if (/^[a-f\d]{3}$/i.test(compact)) {
    return `#${compact
      .split('')
      .map(char => `${char}${char}`)
      .join('')}`.toLowerCase()
  }

  if (/^[a-f\d]{6}$/i.test(compact)) {
    return `#${compact}`.toLowerCase()
  }

  return null
}

const hexToRgb = (hex: string): RgbValue | null => {
  const normalized = normalizeHex(hex)
  if (!normalized) return null

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  }
}

const rgbToHex = ({ r, g, b }: RgbValue): string =>
  `#${[r, g, b].map(x => clampNumber(x, 0, 255).toString(16).padStart(2, '0')).join('')}`

const rgbToHsl = ({ r, g, b }: RgbValue): HslValue => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const delta = max - min
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)

    switch (max) {
      case red:
        h = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
        break
      case green:
        h = ((blue - red) / delta + 2) / 6
        break
      case blue:
        h = ((red - green) / delta + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

const hslToRgb = ({ h, s, l }: HslValue): RgbValue => {
  const hue = clampNumber(h, 0, 360) / 360
  const saturation = clampNumber(s, 0, 100) / 100
  const lightness = clampNumber(l, 0, 100) / 100
  let r: number
  let g: number
  let b: number

  if (saturation === 0) {
    r = lightness
    g = lightness
    b = lightness
  } else {
    const hueToRgb = (p: number, q: number, t: number) => {
      let nextT = t
      if (nextT < 0) nextT += 1
      if (nextT > 1) nextT -= 1
      if (nextT < 1 / 6) return p + (q - p) * 6 * nextT
      if (nextT < 1 / 2) return q
      if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6
      return p
    }
    const q =
      lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation
    const p = 2 * lightness - q
    r = hueToRgb(p, q, hue + 1 / 3)
    g = hueToRgb(p, q, hue)
    b = hueToRgb(p, q, hue - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

const colorFromHex = (value: string): ColorValues | null => {
  const normalized = normalizeHex(value)
  if (!normalized) return null

  const rgb = hexToRgb(normalized)
  if (!rgb) return null

  return {
    hex: normalized,
    rgb,
    hsl: rgbToHsl(rgb)
  }
}

const INITIAL_COLOR = colorFromHex(DEFAULT_COLOR) ?? {
  hex: DEFAULT_COLOR,
  rgb: { r: 22, g: 119, b: 255 },
  hsl: { h: 215, s: 100, l: 54 }
}

const INITIAL_BACKGROUND = colorFromHex(DEFAULT_BACKGROUND) ?? {
  hex: DEFAULT_BACKGROUND,
  rgb: { r: 255, g: 255, b: 255 },
  hsl: { h: 0, s: 0, l: 100 }
}

const getRelativeLuminance = ({ r, g, b }: RgbValue) => {
  const [red, green, blue] = [r, g, b].map(channel => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const getContrastRatio = (foreground: RgbValue, background: RgbValue) => {
  const foregroundLum = getRelativeLuminance(foreground)
  const backgroundLum = getRelativeLuminance(background)
  const light = Math.max(foregroundLum, backgroundLum)
  const dark = Math.min(foregroundLum, backgroundLum)

  return (light + 0.05) / (dark + 0.05)
}

const mixColor = (from: RgbValue, to: RgbValue, weight: number) => ({
  r: Math.round(from.r + (to.r - from.r) * weight),
  g: Math.round(from.g + (to.g - from.g) * weight),
  b: Math.round(from.b + (to.b - from.b) * weight)
})

const formatRgb = ({ r, g, b }: RgbValue) => `rgb(${r}, ${g}, ${b})`
const formatHsl = ({ h, s, l }: HslValue) => `hsl(${h}, ${s}%, ${l}%)`

const buildPalette = (color: RgbValue): Swatch[] => {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const tintWeights = [0.85, 0.68, 0.5, 0.32, 0.16]
  const shadeWeights = [0.14, 0.28, 0.42, 0.58, 0.72]

  return [
    ...tintWeights.map((weight, index) => ({
      label: `${(index + 1) * 100}`,
      value: rgbToHex(mixColor(color, white, weight))
    })),
    { label: '600', value: rgbToHex(color) },
    ...shadeWeights.map((weight, index) => ({
      label: `${(index + 7) * 100}`,
      value: rgbToHex(mixColor(color, black, weight))
    }))
  ]
}

const ColorClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [colors, setColors] = useState<ColorValues>(INITIAL_COLOR)
  const [background, setBackground] = useState<ColorValues>(INITIAL_BACKGROUND)
  const [hexInput, setHexInput] = useState(INITIAL_COLOR.hex)
  const [backgroundInput, setBackgroundInput] = useState(INITIAL_BACKGROUND.hex)

  const setColor = useCallback((next: ColorValues) => {
    setColors(next)
    setHexInput(next.hex)
  }, [])

  const setBackgroundColor = useCallback((next: ColorValues) => {
    setBackground(next)
    setBackgroundInput(next.hex)
  }, [])

  const handleHexChange = useCallback(
    (value: string) => {
      setHexInput(value)
      const next = colorFromHex(value)
      if (next) setColor(next)
    },
    [setColor]
  )

  const handleBackgroundChange = useCallback(
    (value: string) => {
      setBackgroundInput(value)
      const next = colorFromHex(value)
      if (next) setBackgroundColor(next)
    },
    [setBackgroundColor]
  )

  const handleRgbChange = useCallback(
    (key: keyof RgbValue, value: string) => {
      const rgb = { ...colors.rgb, [key]: clampNumber(Number(value), 0, 255) }
      setColor({ hex: rgbToHex(rgb), rgb, hsl: rgbToHsl(rgb) })
    },
    [colors.rgb, setColor]
  )

  const handleHslChange = useCallback(
    (key: keyof HslValue, value: string) => {
      const hsl = { ...colors.hsl, [key]: clampNumber(Number(value), 0, key === 'h' ? 360 : 100) }
      const rgb = hslToRgb(hsl)
      setColor({ hex: rgbToHex(rgb), rgb, hsl })
    },
    [colors.hsl, setColor]
  )

  const handleReset = useCallback(() => {
    setColor(INITIAL_COLOR)
    setBackgroundColor(INITIAL_BACKGROUND)
  }, [setBackgroundColor, setColor])

  const hexStr = colors.hex.toUpperCase()
  const rgbStr = formatRgb(colors.rgb)
  const hslStr = formatHsl(colors.hsl)
  const cssVariables = `--color: ${hexStr};\n--color-rgb: ${colors.rgb.r} ${colors.rgb.g} ${colors.rgb.b};\n--color-hsl: ${colors.hsl.h} ${colors.hsl.s}% ${colors.hsl.l}%;`

  const palette = useMemo(() => buildPalette(colors.rgb), [colors.rgb])
  const contrastRatio = useMemo(
    () => getContrastRatio(colors.rgb, background.rgb),
    [background.rgb, colors.rgb]
  )
  const contrastScore = contrastRatio.toFixed(2)
  const contrastChecks = [
    {
      label: t('app.converter.color.wcag.normal_aa'),
      pass: contrastRatio >= 4.5
    },
    {
      label: t('app.converter.color.wcag.normal_aaa'),
      pass: contrastRatio >= 7
    },
    {
      label: t('app.converter.color.wcag.large_aa'),
      pass: contrastRatio >= 3
    },
    {
      label: t('app.converter.color.wcag.ui'),
      pass: contrastRatio >= 3
    }
  ]

  const copyPalette = () => {
    void copy(palette.map(item => `${item.label}: ${item.value.toUpperCase()}`).join('\n'))
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-x-hidden pb-1">
      <Card className="rounded-3xl">
        <CardHeader className="pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.color')}
              </CardTitle>
              <CardDescription>{t('app.converter.color.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
            >
              {t('app.converter.color.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-end">
            <div
              className="h-32 w-full rounded-3xl border border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_50px_rgba(0,0,0,0.18)] lg:h-36"
              style={{
                background: `radial-gradient(circle at 26% 18%, rgba(255,255,255,0.45), transparent 34%), ${colors.hex}`
              }}
              aria-label={hexStr}
            />

            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <div className="grid min-w-0 gap-3">
                <Label htmlFor="color-picker" className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  {t('app.converter.color.foreground')}
                </Label>
                <ColorPicker
                  id="color-picker"
                  value={colors.hex}
                  onChange={value => {
                    const next = colorFromHex(value)
                    if (next) setColor(next)
                  }}
                />
              </div>

              <div className="grid min-w-0 gap-3">
                <Label htmlFor="color-contrast-bg">{t('app.converter.color.background')}</Label>
                <ColorPicker
                  id="color-contrast-bg"
                  value={background.hex}
                  onChange={value => {
                    const next = colorFromHex(value)
                    if (next) setBackgroundColor(next)
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className="glass-panel glass-clip rounded-3xl p-5"
            style={{
              backgroundColor: background.hex
            }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-2xl font-semibold leading-tight" style={{ color: colors.hex }}>
                  {t('app.converter.color.preview_text')}
                </div>
                <div className="mt-1 font-mono text-sm" style={{ color: colors.hex }}>
                  {hexStr} on {background.hex.toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                {contrastChecks.map(item => (
                  <div
                    key={item.label}
                    className={[
                      'rounded-2xl border px-3 py-2 text-sm',
                      item.pass
                        ? 'border-[var(--success)] bg-[var(--success-subtle)] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--glass-input-bg)] text-[var(--text-secondary)]'
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={[
                          'h-4 w-4',
                          item.pass ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
                        ].join(' ')}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <ColorFormatCard
            title="HEX"
            value={hexInput}
            displayValue={hexStr}
            onValueChange={handleHexChange}
            onCopy={() => void copy(hexStr)}
          />

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
              <CopyRow value={rgbStr} onCopy={() => void copy(rgbStr)} />
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
              <CopyRow value={hslStr} onCopy={() => void copy(hslStr)} />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.color.contrast')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-input rounded-2xl p-3">
                <div className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.color.ratio')}
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {contrastScore}
                </div>
              </div>
              <div className="glass-input rounded-2xl p-3">
                <div className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.color.luminance')}
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {getRelativeLuminance(colors.rgb).toFixed(3)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="color-background-input">
                {t('app.converter.color.background_hex')}
              </Label>
              <Input
                id="color-background-input"
                value={backgroundInput}
                onChange={event => handleBackgroundChange(event.target.value)}
                className="font-mono uppercase"
              />
            </div>
            <CopyRow value={cssVariables} onCopy={() => void copy(cssVariables)} multiline />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.color.palette')}
            </CardTitle>
            <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={copyPalette}>
              {t('app.generation.uuid.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11">
            {palette.map(item => (
              <button
                key={`${item.label}-${item.value}`}
                type="button"
                onClick={() => void copy(item.value.toUpperCase())}
                className="glass-panel glass-clip group flex min-h-28 flex-col overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:glass-panel-strong"
              >
                <span
                  className="h-14 w-full border-b border-[var(--glass-border)]"
                  style={{ backgroundColor: item.value }}
                />
                <span className="flex flex-1 flex-col justify-center gap-1 px-3 py-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </span>
                  <span className="truncate font-mono text-xs uppercase text-[var(--text-secondary)]">
                    {item.value}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const ColorFormatCard = ({
  displayValue,
  onCopy,
  onValueChange,
  title,
  value
}: {
  displayValue: string
  onCopy: () => void
  onValueChange: (value: string) => void
  title: string
  value: string
}) => (
  <Card className="rounded-3xl">
    <CardHeader className="pb-5">
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-5 pb-6">
      <Input
        value={value}
        onChange={event => onValueChange(event.target.value)}
        className="font-mono uppercase"
      />
      <CopyRow value={displayValue} onCopy={onCopy} />
    </CardContent>
  </Card>
)

const CopyRow = ({
  multiline,
  onCopy,
  value
}: {
  multiline?: boolean
  onCopy: () => void
  value: string
}) => (
  <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3">
    <code
      className={[
        'min-w-0 flex-1 font-mono text-sm text-[var(--text-primary)]',
        multiline ? 'whitespace-pre-wrap break-all' : 'truncate'
      ].join(' ')}
    >
      {value}
    </code>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-xl"
      onClick={onCopy}
    >
      <Copy className="h-4 w-4" />
    </Button>
  </div>
)

export default ColorClient
