'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type DisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
type Direction = 'auto' | 'ltr' | 'rtl'
type FindingLevel = 'danger' | 'good' | 'warn'
type IconPurpose = 'any' | 'maskable' | 'monochrome' | 'any maskable'
type ManifestPresetId = 'utility' | 'commerce' | 'media' | 'dashboard'
type Orientation =
  | 'any'
  | 'natural'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape'
  | 'landscape-primary'
  | 'landscape-secondary'
type ScreenshotFormFactor = 'narrow' | 'wide'

interface IconEntry {
  id: string
  purpose: IconPurpose
  sizes: string
  src: string
  type: string
}

interface ScreenshotEntry {
  formFactor: ScreenshotFormFactor
  id: string
  label: string
  sizes: string
  src: string
  type: string
}

interface ManifestPreset {
  backgroundColor: string
  categories: string
  description: string
  display: DisplayMode
  displayOverride: string
  id: string
  name: string
  orientation: Orientation
  screenshots: ScreenshotEntry[]
  shortName: string
  themeColor: string
}

interface ManifestFinding {
  key: string
  level: FindingLevel
  subject: string
}

interface ParsedManifest {
  capped: boolean
  data: Record<string, unknown> | null
  error: string
  unknownKeys: string[]
}

const DEFAULT_ICONS: IconEntry[] = [
  {
    id: 'icon-192',
    src: '/icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any'
  },
  {
    id: 'icon-512',
    src: '/icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  }
]

const DEFAULT_SCREENSHOTS: ScreenshotEntry[] = [
  {
    id: 'screen-narrow',
    src: '/screenshots/mobile.png',
    sizes: '1170x2532',
    type: 'image/png',
    formFactor: 'narrow',
    label: 'Mobile dashboard'
  },
  {
    id: 'screen-wide',
    src: '/screenshots/desktop.png',
    sizes: '2880x1800',
    type: 'image/png',
    formFactor: 'wide',
    label: 'Desktop dashboard'
  }
]

const MANIFEST_PRESETS: Record<ManifestPresetId, ManifestPreset> = {
  utility: {
    name: 'Daily Tools',
    shortName: 'Tools',
    description: 'A local-first utility toolbox for developers.',
    id: '/',
    display: 'standalone',
    orientation: 'any',
    themeColor: '#1677ff',
    backgroundColor: '#0b1020',
    categories: 'utilities, productivity, developer tools',
    displayOverride: 'window-controls-overlay, standalone',
    screenshots: DEFAULT_SCREENSHOTS
  },
  commerce: {
    name: 'Storefront',
    shortName: 'Store',
    description: 'A fast installable shopping experience.',
    id: '/shop',
    display: 'standalone',
    orientation: 'portrait',
    themeColor: '#0f766e',
    backgroundColor: '#082f49',
    categories: 'shopping, lifestyle',
    displayOverride: 'standalone, minimal-ui',
    screenshots: [
      {
        id: 'commerce-narrow',
        src: '/screenshots/store-mobile.png',
        sizes: '1170x2532',
        type: 'image/png',
        formFactor: 'narrow',
        label: 'Mobile storefront'
      }
    ]
  },
  media: {
    name: 'Studio Player',
    shortName: 'Player',
    description: 'A focused media playback app.',
    id: '/player',
    display: 'fullscreen',
    orientation: 'landscape',
    themeColor: '#7c3aed',
    backgroundColor: '#111827',
    categories: 'music, entertainment',
    displayOverride: 'fullscreen, standalone',
    screenshots: [
      {
        id: 'media-wide',
        src: '/screenshots/player-wide.png',
        sizes: '2880x1800',
        type: 'image/png',
        formFactor: 'wide',
        label: 'Wide player'
      }
    ]
  },
  dashboard: {
    name: 'Operations Console',
    shortName: 'Console',
    description: 'A dense dashboard for repeated operational workflows.',
    id: '/app',
    display: 'standalone',
    orientation: 'landscape',
    themeColor: '#2563eb',
    backgroundColor: '#0f172a',
    categories: 'business, productivity',
    displayOverride: 'window-controls-overlay, standalone',
    screenshots: [
      {
        id: 'dashboard-wide',
        src: '/screenshots/console-wide.png',
        sizes: '2880x1800',
        type: 'image/png',
        formFactor: 'wide',
        label: 'Operations overview'
      }
    ]
  }
}

const DISPLAY_OPTIONS: DisplayMode[] = ['standalone', 'fullscreen', 'minimal-ui', 'browser']
const DIR_OPTIONS: Direction[] = ['auto', 'ltr', 'rtl']
const FORM_FACTOR_OPTIONS: ScreenshotFormFactor[] = ['narrow', 'wide']
const ICON_PURPOSE_OPTIONS: IconPurpose[] = ['any', 'maskable', 'monochrome', 'any maskable']
const ORIENTATION_OPTIONS: Orientation[] = [
  'any',
  'natural',
  'portrait',
  'portrait-primary',
  'portrait-secondary',
  'landscape',
  'landscape-primary',
  'landscape-secondary'
]
const MANIFEST_WORKSPACE_LIMIT = 40000
const MANIFEST_FIELD_LIMIT = 240
const MANIFEST_DESCRIPTION_LIMIT = 1200
const MANIFEST_CATEGORIES_LIMIT = 600
const MANIFEST_DISPLAY_OVERRIDE_LIMIT = 420
const MANIFEST_ICON_LIMIT = 24
const MANIFEST_SCREENSHOT_LIMIT = 16
const VISIBLE_MANIFEST_ICON_ROWS = 16
const VISIBLE_MANIFEST_SCREENSHOT_ROWS = 10
const MANIFEST_SCREENSHOT_LABEL_LIMIT = 240
const KNOWN_MANIFEST_KEYS = new Set([
  'background_color',
  'categories',
  'description',
  'dir',
  'display',
  'display_override',
  'icons',
  'id',
  'lang',
  'name',
  'orientation',
  'scope',
  'screenshots',
  'short_name',
  'start_url',
  'theme_color'
])
const DEFAULT_MANIFEST_JSON = JSON.stringify(
  {
    name: 'Daily Tools',
    short_name: 'Tools',
    description: 'A local-first utility toolbox for developers.',
    id: '/',
    start_url: '/',
    scope: '/',
    lang: 'en',
    dir: 'auto',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#1677ff',
    background_color: '#0b1020',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  null,
  2
)

const makeId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

const cloneIcons = () => DEFAULT_ICONS.map(icon => ({ ...icon }))
const cloneScreenshots = (items = DEFAULT_SCREENSHOTS) => items.map(item => ({ ...item }))

const parseList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,;\n]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  )

const isPathOrHttpUrl = (value: string) => /^(\/|https?:\/\/)/i.test(value.trim())
const isHexColor = (value: string) => /^#[\da-f]{3}([\da-f]{3})?$/i.test(value.trim())
const isValidSizes = (value: string) => /^(any|\d+x\d+)(\s+\d+x\d+)*$/i.test(value.trim())
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getString = (data: Record<string, unknown>, key: string, fallback = '') => {
  const value = data[key]
  return typeof value === 'string' ? value : fallback
}

const getStringList = (data: Record<string, unknown>, key: string) => {
  const value = data[key]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') return parseList(value)

  return []
}

const toIconPurpose = (value: unknown): IconPurpose => {
  if (typeof value === 'string' && ICON_PURPOSE_OPTIONS.includes(value as IconPurpose))
    return value as IconPurpose
  return 'any'
}

const toScreenshotFormFactor = (value: unknown): ScreenshotFormFactor => {
  if (value === 'wide' || value === 'narrow') return value
  return 'narrow'
}

const toDisplayMode = (value: string): DisplayMode =>
  DISPLAY_OPTIONS.includes(value as DisplayMode) ? (value as DisplayMode) : 'standalone'
const toDirection = (value: string): Direction =>
  DIR_OPTIONS.includes(value as Direction) ? (value as Direction) : 'auto'
const toOrientation = (value: string): Orientation =>
  ORIENTATION_OPTIONS.includes(value as Orientation) ? (value as Orientation) : 'any'

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const downloadJson = (content: string) => {
  const blob = new Blob([content], { type: 'application/manifest+json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'manifest.webmanifest'
  anchor.click()
  URL.revokeObjectURL(url)
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

const parseManifestWorkspace = (input: string): ParsedManifest => {
  const capped = input.length > MANIFEST_WORKSPACE_LIMIT
  const safeInput = input.slice(0, MANIFEST_WORKSPACE_LIMIT)

  if (!safeInput.trim()) return { capped, data: null, error: '', unknownKeys: [] }

  try {
    const parsed: unknown = JSON.parse(safeInput)
    if (!isRecord(parsed)) {
      return { capped, data: null, error: 'not_object', unknownKeys: [] }
    }

    return {
      capped,
      data: parsed,
      error: '',
      unknownKeys: Object.keys(parsed).filter(key => !KNOWN_MANIFEST_KEYS.has(key))
    }
  } catch (error) {
    return {
      capped,
      data: null,
      error: error instanceof Error ? error.message : 'invalid_json',
      unknownKeys: []
    }
  }
}

const mapParsedIcons = (data: Record<string, unknown>): IconEntry[] => {
  const iconsValue = data.icons
  if (!Array.isArray(iconsValue)) return []

  return iconsValue
    .filter(isRecord)
    .slice(0, 12)
    .map((icon, index) => ({
      id: `parsed-icon-${index}`,
      purpose: toIconPurpose(icon.purpose),
      sizes: getString(icon, 'sizes', '512x512'),
      src: getString(icon, 'src'),
      type: getString(icon, 'type', 'image/png')
    }))
    .filter(icon => icon.src)
}

const mapParsedScreenshots = (data: Record<string, unknown>): ScreenshotEntry[] => {
  const screenshotsValue = data.screenshots
  if (!Array.isArray(screenshotsValue)) return []

  return screenshotsValue
    .filter(isRecord)
    .slice(0, 8)
    .map((screenshot, index) => ({
      formFactor: toScreenshotFormFactor(screenshot.form_factor),
      id: `parsed-screen-${index}`,
      label: getString(screenshot, 'label'),
      sizes: getString(screenshot, 'sizes', '1170x2532'),
      src: getString(screenshot, 'src'),
      type: getString(screenshot, 'type', 'image/png')
    }))
    .filter(screenshot => screenshot.src)
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: ManifestFinding[]) =>
  [
    ['level', 'key', 'subject'].map(csvCell).join(','),
    ...findings.map(finding => [finding.level, finding.key, finding.subject].map(csvCell).join(','))
  ].join('\n')

const ManifestClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [name, setName] = useState('Daily Tools')
  const [shortName, setShortName] = useState('Tools')
  const [description, setDescription] = useState('A local-first utility toolbox for developers.')
  const [manifestId, setManifestId] = useState('/')
  const [startUrl, setStartUrl] = useState('/')
  const [scope, setScope] = useState('/')
  const [lang, setLang] = useState('en')
  const [dir, setDir] = useState<Direction>('auto')
  const [categories, setCategories] = useState('utilities, productivity, developer tools')
  const [displayOverride, setDisplayOverride] = useState('window-controls-overlay, standalone')
  const [display, setDisplay] = useState<DisplayMode>('standalone')
  const [orientation, setOrientation] = useState<Orientation>('any')
  const [themeColor, setThemeColor] = useState('#1677ff')
  const [backgroundColor, setBackgroundColor] = useState('#0b1020')
  const [icons, setIcons] = useState(cloneIcons)
  const [screenshots, setScreenshots] = useState(cloneScreenshots)
  const [workspace, setWorkspace] = useState(DEFAULT_MANIFEST_JSON)
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const deferredWorkspace = useDeferredValue(workspace)

  const categoryList = useMemo(() => parseList(categories), [categories])
  const displayOverrideList = useMemo(() => parseList(displayOverride), [displayOverride])
  const parsedManifest = useMemo(() => {
    const next = parseManifestWorkspace(deferredWorkspace)

    return isWorkspaceCapped ? { ...next, capped: true } : next
  }, [deferredWorkspace, isWorkspaceCapped])
  const visibleIcons = useMemo(() => icons.slice(0, VISIBLE_MANIFEST_ICON_ROWS), [icons])
  const visibleScreenshots = useMemo(
    () => screenshots.slice(0, VISIBLE_MANIFEST_SCREENSHOT_ROWS),
    [screenshots]
  )
  const isIconCapReached = icons.length >= MANIFEST_ICON_LIMIT
  const isScreenshotCapReached = screenshots.length >= MANIFEST_SCREENSHOT_LIMIT
  const isIconListLimited = icons.length > visibleIcons.length
  const isScreenshotListLimited = screenshots.length > visibleScreenshots.length

  const updateWorkspace = (value: string) => {
    const capped = value.length > MANIFEST_WORKSPACE_LIMIT

    setIsWorkspaceCapped(capped)
    setWorkspace(capped ? value.slice(0, MANIFEST_WORKSPACE_LIMIT) : value)
  }

  const manifest = useMemo(() => {
    const payload: Record<string, unknown> = {
      name: name.trim(),
      short_name: shortName.trim(),
      description: description.trim(),
      id: manifestId.trim(),
      start_url: startUrl.trim(),
      scope: scope.trim(),
      lang: lang.trim(),
      dir,
      display,
      orientation,
      theme_color: themeColor,
      background_color: backgroundColor,
      icons: icons
        .filter(icon => icon.src.trim())
        .map(icon => ({
          src: icon.src.trim(),
          sizes: icon.sizes.trim(),
          type: icon.type.trim(),
          purpose: icon.purpose
        }))
    }

    if (displayOverrideList.length > 0) payload.display_override = displayOverrideList
    if (categoryList.length > 0) payload.categories = categoryList

    const screenshotList = screenshots
      .filter(screenshot => screenshot.src.trim())
      .map(screenshot => ({
        src: screenshot.src.trim(),
        sizes: screenshot.sizes.trim(),
        type: screenshot.type.trim(),
        form_factor: screenshot.formFactor,
        label: screenshot.label.trim()
      }))

    if (screenshotList.length > 0) payload.screenshots = screenshotList

    return payload
  }, [
    backgroundColor,
    categoryList,
    description,
    dir,
    display,
    displayOverrideList,
    icons,
    lang,
    manifestId,
    name,
    orientation,
    scope,
    screenshots,
    shortName,
    startUrl,
    themeColor
  ])

  const manifestJson = useMemo(() => JSON.stringify(manifest, null, 2), [manifest])
  const html = useMemo(() => {
    const appleIcon = icons.find(icon => icon.sizes.includes('192x192'))?.src ?? icons[0]?.src
    const iconLine = appleIcon
      ? `\n<link rel="apple-touch-icon" href="${escapeHtml(appleIcon)}">`
      : ''

    return `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="${escapeHtml(themeColor)}">
<meta name="application-name" content="${escapeHtml(name)}">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(shortName)}">
<meta name="apple-mobile-web-app-capable" content="yes">${iconLine}`
  }, [icons, name, shortName, themeColor])

  const validation = useMemo(() => {
    const warnings: string[] = []

    if (!name.trim()) warnings.push(t('app.generation.manifest.warning.name'))
    if (!shortName.trim()) warnings.push(t('app.generation.manifest.warning.short_name'))
    if (!isPathOrHttpUrl(startUrl)) warnings.push(t('app.generation.manifest.warning.start_url'))
    if (!isPathOrHttpUrl(scope)) warnings.push(t('app.generation.manifest.warning.scope'))
    if (!isHexColor(themeColor)) warnings.push(t('app.generation.manifest.warning.theme'))
    if (!isHexColor(backgroundColor)) warnings.push(t('app.generation.manifest.warning.background'))
    if (!icons.some(icon => icon.sizes.includes('192x192'))) {
      warnings.push(t('app.generation.manifest.warning.icon_192'))
    }
    if (!icons.some(icon => icon.sizes.includes('512x512'))) {
      warnings.push(t('app.generation.manifest.warning.icon_512'))
    }
    if (!icons.some(icon => icon.purpose.includes('maskable'))) {
      warnings.push(t('app.generation.manifest.warning.maskable'))
    }

    icons.forEach(icon => {
      if (icon.src.trim() && !isValidSizes(icon.sizes)) {
        warnings.push(t('app.generation.manifest.warning.icon_size', { src: icon.src }))
      }
    })

    screenshots.forEach(screenshot => {
      if (screenshot.src.trim() && !isValidSizes(screenshot.sizes)) {
        warnings.push(t('app.generation.manifest.warning.screenshot_size', { src: screenshot.src }))
      }
    })

    return warnings
  }, [backgroundColor, icons, name, scope, screenshots, shortName, startUrl, t, themeColor])
  const manifestFindings = useMemo<ManifestFinding[]>(() => {
    const findings: ManifestFinding[] = validation.map(warning => ({
      key: 'builder_warning',
      level: 'warn',
      subject: warning
    }))

    if (parsedManifest.capped)
      findings.push({
        key: 'workspace_capped',
        level: 'warn',
        subject: String(MANIFEST_WORKSPACE_LIMIT)
      })
    if (parsedManifest.error)
      findings.push({ key: 'parser_error', level: 'danger', subject: parsedManifest.error })
    if (workspace.trim() && !parsedManifest.data && !parsedManifest.error)
      findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })

    const data = parsedManifest.data
    if (data) {
      if (!getString(data, 'name'))
        findings.push({ key: 'parsed_name_missing', level: 'danger', subject: 'name' })
      if (!getString(data, 'short_name'))
        findings.push({ key: 'parsed_short_name_missing', level: 'warn', subject: 'short_name' })
      const parsedStart = getString(data, 'start_url')
      const parsedScope = getString(data, 'scope')
      const parsedTheme = getString(data, 'theme_color')
      const parsedBackground = getString(data, 'background_color')
      const parsedIcons = mapParsedIcons(data)
      const parsedScreenshots = mapParsedScreenshots(data)
      if (parsedStart && !isPathOrHttpUrl(parsedStart))
        findings.push({ key: 'parsed_start_url_invalid', level: 'danger', subject: parsedStart })
      if (parsedScope && !isPathOrHttpUrl(parsedScope))
        findings.push({ key: 'parsed_scope_invalid', level: 'danger', subject: parsedScope })
      if (parsedTheme && !isHexColor(parsedTheme))
        findings.push({ key: 'parsed_theme_invalid', level: 'warn', subject: parsedTheme })
      if (parsedBackground && !isHexColor(parsedBackground))
        findings.push({
          key: 'parsed_background_invalid',
          level: 'warn',
          subject: parsedBackground
        })
      if (
        getString(data, 'display') &&
        !DISPLAY_OPTIONS.includes(getString(data, 'display') as DisplayMode)
      )
        findings.push({
          key: 'parsed_display_unknown',
          level: 'warn',
          subject: getString(data, 'display')
        })
      if (parsedIcons.length === 0)
        findings.push({ key: 'parsed_icons_missing', level: 'danger', subject: 'icons' })
      if (!parsedIcons.some(icon => icon.sizes.includes('192x192')))
        findings.push({ key: 'parsed_icon_192_missing', level: 'warn', subject: '192x192' })
      if (!parsedIcons.some(icon => icon.sizes.includes('512x512')))
        findings.push({ key: 'parsed_icon_512_missing', level: 'warn', subject: '512x512' })
      if (!parsedIcons.some(icon => icon.purpose.includes('maskable')))
        findings.push({ key: 'parsed_maskable_missing', level: 'warn', subject: 'maskable' })
      if (parsedScreenshots.length === 0)
        findings.push({ key: 'parsed_screenshots_missing', level: 'warn', subject: 'screenshots' })
      if (parsedManifest.unknownKeys.length > 0)
        findings.push({
          key: 'parsed_unknown_keys',
          level: 'warn',
          subject: parsedManifest.unknownKeys.join(', ')
        })
    }

    if (findings.length === 0)
      findings.push({ key: 'ready', level: 'good', subject: name || 'manifest' })

    return findings
  }, [name, parsedManifest, validation, workspace])
  const manifestFindingsCsv = useMemo(() => buildFindingsCsv(manifestFindings), [manifestFindings])

  const stats = useMemo(
    () => [
      {
        label: t('app.generation.manifest.stats.icons'),
        value: icons.filter(icon => icon.src.trim()).length
      },
      {
        label: t('app.generation.manifest.stats.screenshots'),
        value: screenshots.filter(screenshot => screenshot.src.trim()).length
      },
      { label: t('app.generation.manifest.stats.categories'), value: categoryList.length },
      { label: t('app.generation.manifest.stats.checks'), value: validation.length }
    ],
    [categoryList.length, icons, screenshots, t, validation.length]
  )

  const updateIcon = (id: string, field: keyof IconEntry, value: string) => {
    setIcons(prev => prev.map(icon => (icon.id === id ? { ...icon, [field]: value } : icon)))
  }

  const updateScreenshot = (id: string, field: keyof ScreenshotEntry, value: string) => {
    setScreenshots(prev =>
      prev.map(screenshot =>
        screenshot.id === id ? { ...screenshot, [field]: value } : screenshot
      )
    )
  }

  const applyPreset = (presetId: ManifestPresetId) => {
    const preset = MANIFEST_PRESETS[presetId]
    setName(preset.name)
    setShortName(preset.shortName)
    setDescription(preset.description)
    setManifestId(preset.id)
    setStartUrl(preset.id)
    setScope(preset.id === '/' ? '/' : `${preset.id}/`)
    setDisplay(preset.display)
    setOrientation(preset.orientation)
    setThemeColor(preset.themeColor)
    setBackgroundColor(preset.backgroundColor)
    setCategories(preset.categories)
    setDisplayOverride(preset.displayOverride)
    setIcons(cloneIcons())
    setScreenshots(cloneScreenshots(preset.screenshots))
  }

  const reset = () => {
    setName('Daily Tools')
    setShortName('Tools')
    setDescription('A local-first utility toolbox for developers.')
    setManifestId('/')
    setStartUrl('/')
    setScope('/')
    setLang('en')
    setDir('auto')
    setCategories('utilities, productivity, developer tools')
    setDisplayOverride('window-controls-overlay, standalone')
    setDisplay('standalone')
    setOrientation('any')
    setThemeColor('#1677ff')
    setBackgroundColor('#0b1020')
    setIcons(cloneIcons())
    setScreenshots(cloneScreenshots())
    updateWorkspace(DEFAULT_MANIFEST_JSON)
  }

  const applyParsedManifest = () => {
    const data = parsedManifest.data
    if (!data) return

    setName(getString(data, 'name', name))
    setShortName(getString(data, 'short_name', shortName))
    setDescription(getString(data, 'description', description))
    setManifestId(getString(data, 'id', manifestId))
    setStartUrl(getString(data, 'start_url', startUrl))
    setScope(getString(data, 'scope', scope))
    setLang(getString(data, 'lang', lang))
    setDir(toDirection(getString(data, 'dir', dir)))
    setCategories(getStringList(data, 'categories').join(', ') || categories)
    setDisplayOverride(getStringList(data, 'display_override').join(', ') || displayOverride)
    setDisplay(toDisplayMode(getString(data, 'display', display)))
    setOrientation(toOrientation(getString(data, 'orientation', orientation)))
    setThemeColor(getString(data, 'theme_color', themeColor))
    setBackgroundColor(getString(data, 'background_color', backgroundColor))
    const parsedIcons = mapParsedIcons(data)
    const parsedScreenshots = mapParsedScreenshots(data)
    if (parsedIcons.length > 0) setIcons(parsedIcons)
    if (parsedScreenshots.length > 0) setScreenshots(parsedScreenshots)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.manifest')}
              </CardTitle>
              <CardDescription>{t('app.generation.manifest.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(manifestJson)}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(html)}
              >
                {t('app.generation.manifest.copy_html')}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(item => (
              <div key={item.label} className="glass-input rounded-xl p-3">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            {(['utility', 'commerce', 'media', 'dashboard'] as const).map(presetId => (
              <button
                key={presetId}
                type="button"
                className="glass-input rounded-xl p-3 text-left transition-all hover:glass-panel-strong"
                onClick={() => applyPreset(presetId)}
              >
                <div className="text-sm font-semibold">
                  {t(`app.generation.manifest.preset.${presetId}`)}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.generation.manifest.preset.${presetId}.hint`)}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ManifestField
              id="manifest-name"
              label={t('app.generation.manifest.name')}
              value={name}
              onChange={setName}
            />
            <ManifestField
              id="manifest-short"
              label={t('app.generation.manifest.short_name')}
              value={shortName}
              onChange={setShortName}
            />
            <ManifestField
              id="manifest-id"
              label={t('app.generation.manifest.id')}
              value={manifestId}
              onChange={setManifestId}
            />
            <ManifestField
              id="manifest-start"
              label={t('app.generation.manifest.start_url')}
              value={startUrl}
              onChange={setStartUrl}
            />
            <ManifestField
              id="manifest-scope"
              label={t('app.generation.manifest.scope')}
              value={scope}
              onChange={setScope}
            />
            <ManifestField
              id="manifest-lang"
              label={t('app.generation.manifest.lang')}
              value={lang}
              onChange={setLang}
            />
            <div className="space-y-3">
              <Label htmlFor="manifest-dir">{t('app.generation.manifest.dir')}</Label>
              <Select
                id="manifest-dir"
                value={dir}
                onChange={event => setDir(event.target.value as Direction)}
              >
                {DIR_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="manifest-display">{t('app.generation.manifest.display')}</Label>
              <Select
                id="manifest-display"
                value={display}
                onChange={event => setDisplay(event.target.value as DisplayMode)}
              >
                {DISPLAY_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="manifest-orientation">
                {t('app.generation.manifest.orientation')}
              </Label>
              <Select
                id="manifest-orientation"
                value={orientation}
                onChange={event => setOrientation(event.target.value as Orientation)}
              >
                {ORIENTATION_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label>{t('app.generation.manifest.theme')}</Label>
              <ColorPicker value={themeColor} onChange={setThemeColor} />
            </div>
            <div className="space-y-3">
              <Label>{t('app.generation.manifest.background')}</Label>
              <ColorPicker value={backgroundColor} onChange={setBackgroundColor} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="manifest-description">{t('app.generation.manifest.summary')}</Label>
              <Textarea
                id="manifest-description"
                value={description}
                onChange={event =>
                  setDescription(event.target.value.slice(0, MANIFEST_DESCRIPTION_LIMIT))
                }
                rows={3}
                className="resize-none"
              />
              <InputCapNotice
                visible={description.length >= MANIFEST_DESCRIPTION_LIMIT}
                limit={MANIFEST_DESCRIPTION_LIMIT}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="manifest-categories">{t('app.generation.manifest.categories')}</Label>
              <Textarea
                id="manifest-categories"
                value={categories}
                onChange={event =>
                  setCategories(event.target.value.slice(0, MANIFEST_CATEGORIES_LIMIT))
                }
                rows={3}
                className="resize-none font-mono"
              />
              <InputCapNotice
                visible={categories.length >= MANIFEST_CATEGORIES_LIMIT}
                limit={MANIFEST_CATEGORIES_LIMIT}
              />
            </div>
            <div className="space-y-3 lg:col-span-2">
              <Label htmlFor="manifest-display-override">
                {t('app.generation.manifest.display_override')}
              </Label>
              <Input
                id="manifest-display-override"
                value={displayOverride}
                onChange={event =>
                  setDisplayOverride(event.target.value.slice(0, MANIFEST_DISPLAY_OVERRIDE_LIMIT))
                }
                className="font-mono"
              />
            </div>
          </div>

          {validation.length > 0 ? (
            <div className="glass-input rounded-xl p-3">
              <div className="mb-2 text-sm font-semibold text-[var(--warning)]">
                {t('app.generation.manifest.validation')}
              </div>
              <div className="flex flex-wrap gap-2">
                {validation.slice(0, 8).map(warning => (
                  <span
                    key={warning}
                    className="rounded-full border border-[var(--border-base)] bg-[var(--warning-subtle)] px-3 py-1 text-xs text-[var(--warning)]"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success)]">
              {t('app.generation.manifest.validation_ok')}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-[var(--border-base)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{t('app.generation.manifest.icons')}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t('app.generation.manifest.icons_hint')}
                </p>
              </div>
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                disabled={isIconCapReached}
                onClick={() =>
                  setIcons(prev =>
                    prev.length >= MANIFEST_ICON_LIMIT
                      ? prev
                      : [
                          ...prev,
                          {
                            id: makeId('icon'),
                            src: '/icons/icon.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any'
                          }
                        ]
                  )
                }
              >
                {t('public.add')}
              </Button>
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px_160px_44px] gap-3 px-3 text-xs font-medium text-[var(--text-secondary)] md:grid">
              <span>{t('app.generation.manifest.src')}</span>
              <span>{t('app.generation.manifest.sizes')}</span>
              <span>{t('app.generation.manifest.type')}</span>
              <span>{t('app.generation.manifest.purpose')}</span>
              <span />
            </div>
            {visibleIcons.map(icon => (
              <div
                key={icon.id}
                className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_160px_44px]"
              >
                <Input
                  value={icon.src}
                  onChange={event => updateIcon(icon.id, 'src', event.target.value.slice(0, 420))}
                  className="font-mono"
                />
                <Input
                  value={icon.sizes}
                  onChange={event => updateIcon(icon.id, 'sizes', event.target.value.slice(0, 80))}
                  className="font-mono"
                />
                <Input
                  value={icon.type}
                  onChange={event => updateIcon(icon.id, 'type', event.target.value.slice(0, 80))}
                  className="font-mono"
                />
                <Select
                  value={icon.purpose}
                  onChange={event => updateIcon(icon.id, 'purpose', event.target.value)}
                >
                  {ICON_PURPOSE_OPTIONS.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('public.clear')}
                  onClick={() => setIcons(prev => prev.filter(item => item.id !== icon.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {isIconListLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.manifest.warning.icons_limited', {
                  total: icons.length.toLocaleString(),
                  visible: visibleIcons.length.toLocaleString()
                })}
              </p>
            )}
            {isIconCapReached && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.manifest.warning.icons_cap', {
                  limit: MANIFEST_ICON_LIMIT.toLocaleString()
                })}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border-base)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  {t('app.generation.manifest.screenshots')}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t('app.generation.manifest.screenshots_hint')}
                </p>
              </div>
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                disabled={isScreenshotCapReached}
                onClick={() =>
                  setScreenshots(prev =>
                    prev.length >= MANIFEST_SCREENSHOT_LIMIT
                      ? prev
                      : [
                          ...prev,
                          {
                            id: makeId('screen'),
                            src: '/screenshots/app.png',
                            sizes: '1170x2532',
                            type: 'image/png',
                            formFactor: 'narrow',
                            label: ''
                          }
                        ]
                  )
                }
              >
                {t('public.add')}
              </Button>
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_150px_minmax(0,1fr)_44px] gap-3 px-3 text-xs font-medium text-[var(--text-secondary)] lg:grid">
              <span>{t('app.generation.manifest.src')}</span>
              <span>{t('app.generation.manifest.sizes')}</span>
              <span>{t('app.generation.manifest.form_factor')}</span>
              <span>{t('app.generation.manifest.type')}</span>
              <span>{t('app.generation.manifest.label')}</span>
              <span />
            </div>
            {visibleScreenshots.map(screenshot => (
              <div
                key={screenshot.id}
                className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_150px_minmax(0,1fr)_44px]"
              >
                <Input
                  value={screenshot.src}
                  onChange={event =>
                    updateScreenshot(screenshot.id, 'src', event.target.value.slice(0, 420))
                  }
                  className="font-mono"
                />
                <Input
                  value={screenshot.sizes}
                  onChange={event =>
                    updateScreenshot(screenshot.id, 'sizes', event.target.value.slice(0, 80))
                  }
                  className="font-mono"
                />
                <Select
                  value={screenshot.formFactor}
                  onChange={event =>
                    updateScreenshot(screenshot.id, 'formFactor', event.target.value)
                  }
                >
                  {FORM_FACTOR_OPTIONS.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Input
                  value={screenshot.type}
                  onChange={event =>
                    updateScreenshot(screenshot.id, 'type', event.target.value.slice(0, 80))
                  }
                  className="font-mono"
                />
                <Input
                  value={screenshot.label}
                  onChange={event =>
                    updateScreenshot(
                      screenshot.id,
                      'label',
                      event.target.value.slice(0, MANIFEST_SCREENSHOT_LABEL_LIMIT)
                    )
                  }
                  maxLength={MANIFEST_SCREENSHOT_LABEL_LIMIT}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('public.clear')}
                  onClick={() =>
                    setScreenshots(prev => prev.filter(item => item.id !== screenshot.id))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {isScreenshotListLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.manifest.warning.screenshots_limited', {
                  total: screenshots.length.toLocaleString(),
                  visible: visibleScreenshots.length.toLocaleString()
                })}
              </p>
            )}
            {isScreenshotCapReached && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.manifest.warning.screenshots_cap', {
                  limit: MANIFEST_SCREENSHOT_LIMIT.toLocaleString()
                })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.manifest.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.manifest.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.generation.manifest.workspace_placeholder')}
              className="min-h-[240px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-3">
              <ManifestMiniMetric
                label={t('app.generation.manifest.metric.parsed_icons')}
                value={parsedManifest.data ? mapParsedIcons(parsedManifest.data).length : 0}
              />
              <ManifestMiniMetric
                label={t('app.generation.manifest.metric.parsed_screenshots')}
                value={parsedManifest.data ? mapParsedScreenshots(parsedManifest.data).length : 0}
              />
              <ManifestMiniMetric
                label={t('app.generation.manifest.metric.unknown_keys')}
                value={parsedManifest.unknownKeys.length}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={!parsedManifest.data}
                onClick={applyParsedManifest}
              >
                {t('app.generation.manifest.use_parsed')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<FileJson className="h-4 w-4" />}
                onClick={() => updateWorkspace(manifestJson)}
              >
                {t('app.generation.manifest.use_generated')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => updateWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.manifest.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.manifest.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(manifestFindingsCsv)}
              >
                {t('app.generation.manifest.copy_audit_csv')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(manifestFindingsCsv, 'manifest-audit.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.generation.manifest.download_audit_csv')}
              </Button>
            </div>
            <div className="space-y-2">
              {manifestFindings.map(finding => (
                <ManifestFindingRow
                  key={`${finding.key}-${finding.subject}`}
                  finding={finding}
                  label={t(`app.generation.manifest.audit.${finding.key}`)}
                  levelLabel={t(`app.generation.manifest.level.${finding.level}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ManifestOutput
          title="manifest.webmanifest"
          value={manifestJson}
          copyLabel={t('public.copy')}
          onCopy={() => copy(manifestJson)}
        />
        <Card className="flex min-h-[380px] flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.generation.manifest.preview')}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() => downloadJson(manifestJson)}
              >
                {t('app.generation.manifest.download')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(html, 'manifest-head-tags.html', 'text/html;charset=utf-8')
                }
              >
                {t('app.generation.manifest.download_html')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="glass-clip overflow-hidden rounded-2xl border border-[var(--border-base)]"
              style={{ backgroundColor }}
            >
              <div className="p-5" style={{ color: '#ffffff' }}>
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl font-bold"
                  style={{ backgroundColor: themeColor }}
                >
                  {shortName.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-xl font-semibold">{name}</h3>
                <p className="mt-2 text-sm opacity-80">{description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/15 px-2 py-1">{display}</span>
                  <span className="rounded-full bg-white/15 px-2 py-1">{orientation}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="manifest-html">{t('app.generation.manifest.html')}</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => copy(html)}
                >
                  {t('app.generation.manifest.copy_html')}
                </Button>
              </div>
              <Textarea
                id="manifest-html"
                value={html}
                readOnly
                rows={8}
                className="resize-none font-mono"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const ManifestField = ({
  id,
  label,
  limit = MANIFEST_FIELD_LIMIT,
  onChange,
  value
}: {
  id: string
  label: string
  limit?: number
  onChange: (value: string) => void
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} value={value} onChange={event => onChange(event.target.value.slice(0, limit))} />
  </div>
)

const ManifestMiniMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <p className="truncate text-xs font-medium text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

const getFindingColorClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const ManifestFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: ManifestFinding
  label: string
  levelLabel: string
}) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="flex items-start gap-2">
      {finding.level === 'good' ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${finding.level === 'danger' ? 'text-[var(--error)]' : 'text-[var(--warning)]'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getFindingColorClass(finding.level)}`}
          >
            {levelLabel}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
          {finding.subject}
        </p>
      </div>
    </div>
  </div>
)

const ManifestOutput = ({
  copyLabel,
  onCopy,
  title,
  value
}: {
  copyLabel: string
  onCopy: () => void
  title: string
  value: string
}) => (
  <Card className="flex min-h-[380px] flex-col">
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={onCopy}>
          {copyLabel}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <Textarea
        value={value}
        readOnly
        rows={16}
        className="min-h-[300px] flex-1 resize-none font-mono"
      />
    </CardContent>
  </Card>
)

export default ManifestClient
