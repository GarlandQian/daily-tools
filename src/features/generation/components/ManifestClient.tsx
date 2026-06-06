'use client'

import { Copy, Download, Plus, RotateCcw, Smartphone, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type DisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
type Orientation = 'any' | 'portrait' | 'landscape'

interface IconEntry {
  id: string
  purpose: string
  sizes: string
  src: string
  type: string
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

const DEFAULT_ICONS: IconEntry[] = [
  { id: makeId(), src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  {
    id: makeId(),
    src: '/icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  }
]

const downloadJson = (content: string) => {
  const blob = new Blob([content], { type: 'application/manifest+json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'manifest.webmanifest'
  anchor.click()
  URL.revokeObjectURL(url)
}

const ManifestClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [name, setName] = useState('Daily Tools')
  const [shortName, setShortName] = useState('Tools')
  const [description, setDescription] = useState('A local-first utility toolbox for developers.')
  const [startUrl, setStartUrl] = useState('/')
  const [scope, setScope] = useState('/')
  const [display, setDisplay] = useState<DisplayMode>('standalone')
  const [orientation, setOrientation] = useState<Orientation>('any')
  const [themeColor, setThemeColor] = useState('#1677ff')
  const [backgroundColor, setBackgroundColor] = useState('#0b1020')
  const [icons, setIcons] = useState(DEFAULT_ICONS)

  const manifest = useMemo(
    () => ({
      name,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope,
      display,
      orientation,
      theme_color: themeColor,
      background_color: backgroundColor,
      icons: icons
        .filter(icon => icon.src.trim())
        .map(icon => ({
          src: icon.src,
          sizes: icon.sizes,
          type: icon.type,
          purpose: icon.purpose
        }))
    }),
    [
      backgroundColor,
      description,
      display,
      icons,
      name,
      orientation,
      scope,
      shortName,
      startUrl,
      themeColor
    ]
  )
  const manifestJson = useMemo(() => JSON.stringify(manifest, null, 2), [manifest])
  const html = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="${themeColor}">
<meta name="application-name" content="${name}">
<meta name="apple-mobile-web-app-title" content="${shortName}">
<meta name="apple-mobile-web-app-capable" content="yes">`

  const updateIcon = (id: string, field: keyof IconEntry, value: string) => {
    setIcons(prev => prev.map(icon => (icon.id === id ? { ...icon, [field]: value } : icon)))
  }

  const reset = () => {
    setName('Daily Tools')
    setShortName('Tools')
    setDescription('A local-first utility toolbox for developers.')
    setStartUrl('/')
    setScope('/')
    setDisplay('standalone')
    setOrientation('any')
    setThemeColor('#1677ff')
    setBackgroundColor('#0b1020')
    setIcons(DEFAULT_ICONS.map(icon => ({ ...icon, id: makeId() })))
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
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
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
          </div>

          <div className="space-y-3">
            <Label htmlFor="manifest-description">{t('app.generation.manifest.summary')}</Label>
            <Textarea
              id="manifest-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3">
              <Label htmlFor="manifest-display">{t('app.generation.manifest.display')}</Label>
              <Select
                id="manifest-display"
                value={display}
                onChange={event => setDisplay(event.target.value as DisplayMode)}
              >
                {(['standalone', 'fullscreen', 'minimal-ui', 'browser'] as const).map(value => (
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
                {(['any', 'portrait', 'landscape'] as const).map(value => (
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

          <Card className="bg-transparent">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{t('app.generation.manifest.icons')}</CardTitle>
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    setIcons(prev => [
                      ...prev,
                      {
                        id: makeId(),
                        src: '/icons/icon.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                      }
                    ])
                  }
                >
                  {t('public.add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {icons.map(icon => (
                <div
                  key={icon.id}
                  className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px_160px_160px_44px]"
                >
                  <Input
                    value={icon.src}
                    onChange={event => updateIcon(icon.id, 'src', event.target.value)}
                    className="font-mono"
                  />
                  <Input
                    value={icon.sizes}
                    onChange={event => updateIcon(icon.id, 'sizes', event.target.value)}
                    className="font-mono"
                  />
                  <Input
                    value={icon.type}
                    onChange={event => updateIcon(icon.id, 'type', event.target.value)}
                    className="font-mono"
                  />
                  <Input
                    value={icon.purpose}
                    onChange={event => updateIcon(icon.id, 'purpose', event.target.value)}
                    className="font-mono"
                  />
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
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="manifest-html">{t('app.generation.manifest.html')}</Label>
              <Textarea
                id="manifest-html"
                value={html}
                readOnly
                rows={7}
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
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
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
