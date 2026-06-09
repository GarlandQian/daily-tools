'use client'

import {
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

interface HsvValue {
  h: number
  s: number
  v: number
}

interface CmykValue {
  c: number
  m: number
  y: number
  k: number
}

interface OklchValue {
  l: number
  c: number
  h: number
}

interface ColorValues {
  hex: string
  rgb: RgbValue
  hsl: HslValue
}

type ExportFormat = 'css' | 'tailwind' | 'scss' | 'json'
type HarmonyMode = 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'monochrome'

interface Swatch {
  label: string
  value: string
}

const DEFAULT_COLOR = '#1677ff'
const DEFAULT_BACKGROUND = '#ffffff'
const MAX_EXTRACTED_COLORS = 32
const MAX_CSS_INPUT_LENGTH = 12000
const COLOR_PATTERN =
  /#(?:[a-f\d]{3,8})\b|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*(?:[\d.]+%?))?\s*\)|hsla?\(\s*[\d.]+(?:deg)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*(?:[\d.]+%?))?\s*\)/gi

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

const clampFloat = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
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

const normalizeHex8 = (value: string) => {
  const compact = value.trim().replace(/^#/, '')

  if (/^[a-f\d]{4}$/i.test(compact)) {
    return `#${compact
      .split('')
      .map(char => `${char}${char}`)
      .join('')}`.toLowerCase()
  }

  if (/^[a-f\d]{8}$/i.test(compact)) {
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

const rgbToHex8 = (rgb: RgbValue, alpha: number): string => {
  const alphaHex = clampNumber(alpha * 255, 0, 255)
    .toString(16)
    .padStart(2, '0')
  return `${rgbToHex(rgb)}${alphaHex}`
}

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

const rgbToHsv = ({ r, g, b }: RgbValue): HsvValue => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let h = 0

  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
    if (max === green) h = ((blue - red) / delta + 2) * 60
    if (max === blue) h = ((red - green) / delta + 4) * 60
  }

  return {
    h: Math.round(h),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100)
  }
}

const hsvToRgb = ({ h, s, v }: HsvValue): RgbValue => {
  const hue = ((clampNumber(h, 0, 360) % 360) + 360) % 360
  const saturation = clampNumber(s, 0, 100) / 100
  const value = clampNumber(v, 0, 100) / 100
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = value - chroma
  let red = 0
  let green = 0
  let blue = 0

  if (hue < 60) {
    red = chroma
    green = x
  } else if (hue < 120) {
    red = x
    green = chroma
  } else if (hue < 180) {
    green = chroma
    blue = x
  } else if (hue < 240) {
    green = x
    blue = chroma
  } else if (hue < 300) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  return {
    r: Math.round((red + m) * 255),
    g: Math.round((green + m) * 255),
    b: Math.round((blue + m) * 255)
  }
}

const rgbToCmyk = ({ r, g, b }: RgbValue): CmykValue => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const k = 1 - Math.max(red, green, blue)

  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }

  return {
    c: Math.round(((1 - red - k) / (1 - k)) * 100),
    m: Math.round(((1 - green - k) / (1 - k)) * 100),
    y: Math.round(((1 - blue - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  }
}

const cmykToRgb = ({ c, m, y, k }: CmykValue): RgbValue => {
  const cyan = clampNumber(c, 0, 100) / 100
  const magenta = clampNumber(m, 0, 100) / 100
  const yellow = clampNumber(y, 0, 100) / 100
  const black = clampNumber(k, 0, 100) / 100

  return {
    r: Math.round(255 * (1 - cyan) * (1 - black)),
    g: Math.round(255 * (1 - magenta) * (1 - black)),
    b: Math.round(255 * (1 - yellow) * (1 - black))
  }
}

const rgbToOklch = ({ r, g, b }: RgbValue): OklchValue => {
  const toLinear = (channel: number) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const red = toLinear(r)
  const green = toLinear(g)
  const blue = toLinear(b)
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const labL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.sqrt(labA ** 2 + labB ** 2)
  const hue = (Math.atan2(labB, labA) * 180) / Math.PI

  return {
    l: Math.round(labL * 1000) / 10,
    c: Math.round(chroma * 1000) / 1000,
    h: Math.round((hue + 360) % 360)
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

const colorFromRgb = (rgb: RgbValue): ColorValues => ({
  hex: rgbToHex(rgb),
  rgb,
  hsl: rgbToHsl(rgb)
})

const parseCssNumber = (value: string, max: number) => {
  if (value.trim().endsWith('%')) return clampNumber((Number.parseFloat(value) / 100) * max, 0, max)
  return clampNumber(Number.parseFloat(value), 0, max)
}

const parseAlpha = (value: string | undefined) => {
  if (!value) return 1
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) return clampFloat(Number.parseFloat(trimmed) / 100, 0, 1)
  return clampFloat(Number.parseFloat(trimmed), 0, 1)
}

const parseCssColor = (value: string): { alpha: number; color: ColorValues } | null => {
  const trimmed = value.trim()
  const hex8 = normalizeHex8(trimmed)

  if (hex8) {
    const rgb = hexToRgb(hex8.slice(0, 7))
    if (!rgb) return null
    return {
      alpha: Math.round((Number.parseInt(hex8.slice(7, 9), 16) / 255) * 100) / 100,
      color: colorFromRgb(rgb)
    }
  }

  const hex = normalizeHex(trimmed)
  if (hex) {
    const color = colorFromHex(hex)
    return color ? { alpha: 1, color } : null
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)(?:\s*,\s*([\d.]+%?))?\s*\)$/i
  )
  if (rgbMatch) {
    return {
      alpha: parseAlpha(rgbMatch[4]),
      color: colorFromRgb({
        r: parseCssNumber(rgbMatch[1] ?? '0', 255),
        g: parseCssNumber(rgbMatch[2] ?? '0', 255),
        b: parseCssNumber(rgbMatch[3] ?? '0', 255)
      })
    }
  }

  const hslMatch = trimmed.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+%?))?\s*\)$/i
  )
  if (hslMatch) {
    const hsl = {
      h: clampNumber(Number(hslMatch[1]), 0, 360),
      s: clampNumber(Number(hslMatch[2]), 0, 100),
      l: clampNumber(Number(hslMatch[3]), 0, 100)
    }
    const rgb = hslToRgb(hsl)
    return {
      alpha: parseAlpha(hslMatch[4]),
      color: { hex: rgbToHex(rgb), rgb, hsl }
    }
  }

  return null
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
const formatRgba = ({ r, g, b }: RgbValue, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
const formatHsla = ({ h, s, l }: HslValue, alpha: number) =>
  `hsla(${h}, ${s}%, ${l}%, ${alpha.toFixed(2)})`
const formatHsv = ({ h, s, v }: HsvValue) => `hsv(${h}, ${s}%, ${v}%)`
const formatCmyk = ({ c, m, y, k }: CmykValue) => `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`
const formatOklch = ({ l, c, h }: OklchValue) => `oklch(${l}% ${c} ${h})`

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

const rotateHue = (hsl: HslValue, offset: number) => ({
  ...hsl,
  h: (hsl.h + offset + 360) % 360
})

const buildHarmony = (hsl: HslValue, mode: HarmonyMode): Swatch[] => {
  const offsetsByMode: Record<HarmonyMode, number[]> = {
    analogous: [-30, -15, 0, 15, 30],
    complementary: [0, 180, 210, 150],
    monochrome: [0, 0, 0, 0, 0],
    tetradic: [0, 90, 180, 270],
    triadic: [0, 120, 240]
  }
  const lightnessByMode = [34, 44, hsl.l, 64, 76]
  const offsets = offsetsByMode[mode]

  return offsets.map((offset, index) => {
    const nextHsl =
      mode === 'monochrome'
        ? { ...hsl, l: lightnessByMode[index] ?? hsl.l }
        : rotateHue(hsl, offset)
    return {
      label: mode === 'monochrome' ? `${index + 1}` : `${nextHsl.h}deg`,
      value: rgbToHex(hslToRgb(nextHsl))
    }
  })
}

const extractColorsFromCss = (input: string) => {
  const source = input.slice(0, MAX_CSS_INPUT_LENGTH)
  const matches = source.match(COLOR_PATTERN) ?? []
  const seen = new Set<string>()
  const colors: Swatch[] = []

  for (const match of matches) {
    const parsed = parseCssColor(match)
    if (!parsed) continue
    const value = parsed.color.hex.toUpperCase()
    if (seen.has(value)) continue
    seen.add(value)
    colors.push({ label: match.trim(), value })
    if (colors.length >= MAX_EXTRACTED_COLORS) break
  }

  return colors
}

const buildExport = (
  format: ExportFormat,
  palette: Swatch[],
  harmony: Swatch[],
  color: ColorValues,
  alpha: number
) => {
  const name = 'brand'
  const cssPalette = palette
    .map(item => `  --color-${name}-${item.label}: ${item.value.toUpperCase()};`)
    .join('\n')
  const harmonyVars = harmony
    .map((item, index) => `  --color-${name}-harmony-${index + 1}: ${item.value.toUpperCase()};`)
    .join('\n')

  if (format === 'tailwind') {
    return `colors: {\n  ${name}: {\n${palette
      .map(item => `    ${item.label}: '${item.value.toUpperCase()}',`)
      .join('\n')}\n  }\n}`
  }

  if (format === 'scss') {
    return [
      `$color-${name}: ${color.hex.toUpperCase()};`,
      `$color-${name}-alpha: ${alpha.toFixed(2)};`,
      ...palette.map(item => `$color-${name}-${item.label}: ${item.value.toUpperCase()};`),
      ...harmony.map(
        (item, index) => `$color-${name}-harmony-${index + 1}: ${item.value.toUpperCase()};`
      )
    ].join('\n')
  }

  if (format === 'json') {
    return JSON.stringify(
      {
        alpha,
        color: {
          hex: color.hex.toUpperCase(),
          hex8: rgbToHex8(color.rgb, alpha).toUpperCase(),
          hsl: color.hsl,
          rgb: color.rgb
        },
        harmony,
        palette
      },
      null,
      2
    )
  }

  return `:root {\n  --color-${name}: ${color.hex.toUpperCase()};\n  --color-${name}-rgb: ${color.rgb.r} ${color.rgb.g} ${color.rgb.b};\n  --color-${name}-alpha: ${alpha.toFixed(2)};\n${cssPalette}\n${harmonyVars}\n}`
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const ColorClient = () => {
  const { i18n, t } = useTranslation()
  const { copy } = useCopy()

  const [colors, setColors] = useState<ColorValues>(INITIAL_COLOR)
  const [background, setBackground] = useState<ColorValues>(INITIAL_BACKGROUND)
  const [hexInput, setHexInput] = useState(INITIAL_COLOR.hex)
  const [backgroundInput, setBackgroundInput] = useState(INITIAL_BACKGROUND.hex)
  const [alpha, setAlpha] = useState(1)
  const [cssInput, setCssInput] = useState(
    ':root {\n  --brand: #1677ff;\n  --brand-soft: rgba(22, 119, 255, 0.16);\n  --accent: hsl(168, 76%, 42%);\n}'
  )
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css')
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('analogous')
  const [savedSwatches, setSavedSwatches] = useState<Swatch[]>([
    { label: 'primary', value: INITIAL_COLOR.hex.toUpperCase() },
    { label: 'surface', value: '#F6F8FB' },
    { label: 'ink', value: '#111827' }
  ])

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

  const handleHsvChange = useCallback(
    (key: keyof HsvValue, value: string) => {
      const current = rgbToHsv(colors.rgb)
      const hsv = { ...current, [key]: clampNumber(Number(value), 0, key === 'h' ? 360 : 100) }
      const rgb = hsvToRgb(hsv)
      setColor({ hex: rgbToHex(rgb), rgb, hsl: rgbToHsl(rgb) })
    },
    [colors.rgb, setColor]
  )

  const handleCmykChange = useCallback(
    (key: keyof CmykValue, value: string) => {
      const current = rgbToCmyk(colors.rgb)
      const cmyk = { ...current, [key]: clampNumber(Number(value), 0, 100) }
      const rgb = cmykToRgb(cmyk)
      setColor({ hex: rgbToHex(rgb), rgb, hsl: rgbToHsl(rgb) })
    },
    [colors.rgb, setColor]
  )

  const handleReset = useCallback(() => {
    setColor(INITIAL_COLOR)
    setBackgroundColor(INITIAL_BACKGROUND)
    setAlpha(1)
    setExportFormat('css')
    setHarmonyMode('analogous')
  }, [setBackgroundColor, setColor])

  const hexStr = colors.hex.toUpperCase()
  const hex8Str = rgbToHex8(colors.rgb, alpha).toUpperCase()
  const rgbStr = formatRgb(colors.rgb)
  const hslStr = formatHsl(colors.hsl)
  const rgbaStr = formatRgba(colors.rgb, alpha)
  const hslaStr = formatHsla(colors.hsl, alpha)
  const hsv = useMemo(() => rgbToHsv(colors.rgb), [colors.rgb])
  const cmyk = useMemo(() => rgbToCmyk(colors.rgb), [colors.rgb])
  const oklch = useMemo(() => rgbToOklch(colors.rgb), [colors.rgb])
  const hsvStr = formatHsv(hsv)
  const cmykStr = formatCmyk(cmyk)
  const oklchStr = formatOklch(oklch)
  const cssVariables = `--color: ${hexStr};\n--color-rgb: ${colors.rgb.r} ${colors.rgb.g} ${colors.rgb.b};\n--color-hsl: ${colors.hsl.h} ${colors.hsl.s}% ${colors.hsl.l}%;\n--color-alpha: ${alpha.toFixed(2)};`

  const palette = useMemo(() => buildPalette(colors.rgb), [colors.rgb])
  const harmony = useMemo(() => buildHarmony(colors.hsl, harmonyMode), [colors.hsl, harmonyMode])
  const extractedColors = useMemo(() => extractColorsFromCss(cssInput), [cssInput])
  const exportText = useMemo(
    () => buildExport(exportFormat, palette, harmony, colors, alpha),
    [alpha, colors, exportFormat, harmony, palette]
  )
  const contrastRatio = useMemo(
    () => getContrastRatio(colors.rgb, background.rgb),
    [background.rgb, colors.rgb]
  )
  const contrastScore = contrastRatio.toFixed(2)
  const onBackgroundLabel = i18n.language === 'cn' ? '叠加于' : 'on'
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
  const contrastAdvice =
    contrastRatio >= 7
      ? t('app.converter.color.advice.aaa')
      : contrastRatio >= 4.5
        ? t('app.converter.color.advice.aa')
        : contrastRatio >= 3
          ? t('app.converter.color.advice.large')
          : t('app.converter.color.advice.fail')

  const copyPalette = () => {
    void copy(palette.map(item => `${item.label}: ${item.value.toUpperCase()}`).join('\n'))
  }

  const saveCurrentSwatch = () => {
    setSavedSwatches(current => {
      const nextValue = hexStr
      if (current.some(item => item.value.toUpperCase() === nextValue)) return current
      return [{ label: `saved-${current.length + 1}`, value: nextValue }, ...current].slice(0, 16)
    })
  }

  const applySwatch = (value: string) => {
    const next = colorFromHex(value)
    if (next) setColor(next)
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ColorMetric label="HEX8" value={hex8Str} />
            <ColorMetric label="OKLCH" value={oklchStr} />
            <ColorMetric
              label={t('app.converter.color.saved')}
              value={String(savedSwatches.length)}
            />
            <ColorMetric
              label={t('app.converter.color.extracted')}
              value={String(extractedColors.length)}
            />
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-end">
            <div
              className="h-32 w-full rounded-3xl border border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_50px_rgba(0,0,0,0.18)] lg:h-36"
              style={{
                background: `linear-gradient(45deg, rgba(148,163,184,0.22) 25%, transparent 25% 75%, rgba(148,163,184,0.22) 75%), linear-gradient(45deg, rgba(148,163,184,0.22) 25%, transparent 25% 75%, rgba(148,163,184,0.22) 75%), radial-gradient(circle at 26% 18%, rgba(255,255,255,0.45), transparent 34%), ${rgbaStr}`,
                backgroundPosition: '0 0, 10px 10px, 0 0, 0 0',
                backgroundSize: '20px 20px, 20px 20px, auto, auto'
              }}
              aria-label={hexStr}
            />

            <div className="grid min-w-0 gap-4 md:grid-cols-3">
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

              <div className="grid min-w-0 gap-3">
                <Label htmlFor="color-alpha">{t('app.converter.color.alpha')}</Label>
                <div className="glass-input rounded-2xl p-3">
                  <input
                    id="color-alpha"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(alpha * 100)}
                    onChange={event =>
                      setAlpha(clampNumber(Number(event.target.value), 0, 100) / 100)
                    }
                    className="w-full accent-[var(--primary)]"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 font-mono text-xs text-[var(--text-secondary)]">
                    <span>0%</span>
                    <span>{Math.round(alpha * 100)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel glass-clip glass-prism rounded-3xl p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] lg:items-stretch">
              <div
                className="relative min-h-40 overflow-hidden rounded-2xl border border-[var(--glass-border-strong)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_16px_42px_rgba(31,38,135,0.14)]"
                style={{
                  backgroundColor: background.hex,
                  color: colors.hex
                }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.45),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent_48%)]" />
                <div className="relative">
                  <div className="text-2xl font-semibold leading-tight">
                    {t('app.converter.color.preview_text')}
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm">
                    <span>{hex8Str}</span>
                    <span className="opacity-70">{onBackgroundLabel}</span>
                    <span>{background.hex.toUpperCase()}</span>
                  </div>
                  <p className="mt-6 max-w-xl text-sm leading-6 opacity-80">{contrastAdvice}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 content-center">
                {contrastChecks.map(item => (
                  <div
                    key={item.label}
                    className={[
                      'rounded-2xl border px-3 py-2.5 text-sm glass-input',
                      item.pass
                        ? 'border-[var(--success)] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
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
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          <ColorFormatCard
            title="HEX"
            value={hexInput}
            displayValue={hexStr}
            onValueChange={handleHexChange}
            onCopy={() => void copy(hexStr)}
          />

          <ColorFormatCard
            title="HEX8"
            value={hex8Str}
            displayValue={hex8Str}
            onValueChange={value => {
              const parsed = parseCssColor(value)
              if (!parsed) return
              setColor(parsed.color)
              setAlpha(parsed.alpha)
            }}
            onCopy={() => void copy(hex8Str)}
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

          <ColorFormatCard
            title="RGBA"
            value={rgbaStr}
            displayValue={rgbaStr}
            onValueChange={value => {
              const parsed = parseCssColor(value)
              if (!parsed) return
              setColor(parsed.color)
              setAlpha(parsed.alpha)
            }}
            onCopy={() => void copy(rgbaStr)}
          />

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

          <ColorFormatCard
            title="HSLA"
            value={hslaStr}
            displayValue={hslaStr}
            onValueChange={value => {
              const parsed = parseCssColor(value)
              if (!parsed) return
              setColor(parsed.color)
              setAlpha(parsed.alpha)
            }}
            onCopy={() => void copy(hslaStr)}
          />

          <Card className="rounded-3xl">
            <CardHeader className="pb-5">
              <CardTitle>HSV</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pb-6">
              <div className="grid min-w-0 grid-cols-3 gap-4">
                {(['h', 's', 'v'] as const).map(key => (
                  <div key={key} className="flex min-w-0 flex-col gap-3">
                    <Label htmlFor={`color-hsv-${key}`}>{key.toUpperCase()}</Label>
                    <Input
                      id={`color-hsv-${key}`}
                      type="number"
                      min={0}
                      max={key === 'h' ? 360 : 100}
                      value={hsv[key]}
                      onChange={event => handleHsvChange(key, event.target.value)}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
              <CopyRow value={hsvStr} onCopy={() => void copy(hsvStr)} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader className="pb-5">
              <CardTitle>CMYK</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pb-6">
              <div className="grid min-w-0 grid-cols-4 gap-3">
                {(['c', 'm', 'y', 'k'] as const).map(key => (
                  <div key={key} className="flex min-w-0 flex-col gap-3">
                    <Label htmlFor={`color-cmyk-${key}`}>{key.toUpperCase()}</Label>
                    <Input
                      id={`color-cmyk-${key}`}
                      type="number"
                      min={0}
                      max={100}
                      value={cmyk[key]}
                      onChange={event => handleCmykChange(key, event.target.value)}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
              <CopyRow value={cmykStr} onCopy={() => void copy(cmykStr)} />
            </CardContent>
          </Card>

          <ColorFormatCard
            title="OKLCH"
            value={oklchStr}
            displayValue={oklchStr}
            onValueChange={() => undefined}
            onCopy={() => void copy(oklchStr)}
            readOnly
          />
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
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Eye className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.color.readability')}
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{contrastAdvice}</p>
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
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                icon={<Star className="h-4 w-4" />}
                onClick={saveCurrentSwatch}
              >
                {t('app.converter.color.save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    exportText,
                    `color-tokens.${exportFormat === 'json' ? 'json' : exportFormat === 'scss' ? 'scss' : 'css'}`,
                    exportFormat === 'json'
                      ? 'application/json;charset=utf-8'
                      : 'text/plain;charset=utf-8'
                  )
                }
              >
                {t('app.converter.color.download')}
              </Button>
            </div>
            <CopyRow value={cssVariables} onCopy={() => void copy(cssVariables)} multiline />
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wand2 className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.converter.color.harmony')}
                </CardTitle>
                <CardDescription>{t('app.converter.color.harmony_hint')}</CardDescription>
              </div>
              <Select
                value={harmonyMode}
                onChange={event => setHarmonyMode(event.target.value as HarmonyMode)}
              >
                <option value="analogous">{t('app.converter.color.harmony.analogous')}</option>
                <option value="complementary">
                  {t('app.converter.color.harmony.complementary')}
                </option>
                <option value="triadic">{t('app.converter.color.harmony.triadic')}</option>
                <option value="tetradic">{t('app.converter.color.harmony.tetradic')}</option>
                <option value="monochrome">{t('app.converter.color.harmony.monochrome')}</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {harmony.map(item => (
                <SwatchButton
                  key={`${item.label}-${item.value}`}
                  label={item.label}
                  value={item.value}
                  onApply={() => applySwatch(item.value)}
                  onCopy={() => void copy(item.value.toUpperCase())}
                />
              ))}
            </div>
            <CopyRow
              value={harmony.map(item => `${item.label}: ${item.value.toUpperCase()}`).join('\n')}
              onCopy={() =>
                void copy(
                  harmony.map(item => `${item.label}: ${item.value.toUpperCase()}`).join('\n')
                )
              }
              multiline
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.color.extract')}
            </CardTitle>
            <CardDescription>{t('app.converter.color.extract_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            <Textarea
              value={cssInput}
              onChange={event => setCssInput(event.target.value.slice(0, MAX_CSS_INPUT_LENGTH))}
              rows={6}
              className="font-mono"
              placeholder="color: #1677ff;"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {extractedColors.map(item => (
                <SwatchButton
                  key={`${item.label}-${item.value}`}
                  label={item.label}
                  value={item.value}
                  onApply={() => applySwatch(item.value)}
                  onCopy={() => void copy(item.value.toUpperCase())}
                />
              ))}
              {!extractedColors.length && (
                <p className="col-span-full text-sm text-[var(--text-secondary)]">
                  {t('app.converter.color.extract_empty')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Copy className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.color.export')}
              </CardTitle>
              <CardDescription>{t('app.converter.color.export_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="css">{t('app.converter.color.export.css')}</option>
                <option value="tailwind">{t('app.converter.color.export.tailwind')}</option>
                <option value="scss">{t('app.converter.color.export.scss')}</option>
                <option value="json">{t('app.converter.color.export.json')}</option>
              </Select>
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(exportText)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <pre className="max-h-[360px] overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">
            {exportText}
          </pre>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.color.saved')}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setSavedSwatches([])}>
              {t('public.clear')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {savedSwatches.map(item => (
              <SwatchButton
                key={`${item.label}-${item.value}`}
                label={item.label}
                value={item.value}
                onApply={() => applySwatch(item.value)}
                onCopy={() => void copy(item.value.toUpperCase())}
              />
            ))}
            {!savedSwatches.length && (
              <p className="col-span-full text-sm text-[var(--text-secondary)]">
                {t('app.converter.color.saved_empty')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
  readOnly,
  title,
  value
}: {
  displayValue: string
  onCopy: () => void
  onValueChange: (value: string) => void
  readOnly?: boolean
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
        readOnly={readOnly}
      />
      <CopyRow value={displayValue} onCopy={onCopy} />
    </CardContent>
  </Card>
)

const ColorMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

const SwatchButton = ({
  label,
  onApply,
  onCopy,
  value
}: {
  label: string
  onApply: () => void
  onCopy: () => void
  value: string
}) => (
  <button
    type="button"
    onClick={onApply}
    onDoubleClick={onCopy}
    className="glass-panel glass-clip group flex min-h-24 min-w-0 flex-col overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:glass-panel-strong"
  >
    <span
      className="h-12 w-full border-b border-[var(--glass-border)]"
      style={{ backgroundColor: value }}
    />
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="truncate font-mono text-xs uppercase text-[var(--text-secondary)]">
        {value}
      </span>
    </span>
  </button>
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
