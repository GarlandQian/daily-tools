'use client'

import {
  Copy,
  FileCode2,
  FileImage,
  ImagePlus,
  QrCode,
  RefreshCw,
  Sparkles,
  Trash2
} from 'lucide-react'
import Image from 'next/image'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { FileUploadZone } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

interface QrcodeFormData {
  content: string
  size: number
  marginSize: number
  level: ErrorCorrectionLevel
  fgColor: string
  bgColor: string
  transparentBg: boolean
  logoSize: number
  logoExcavate: boolean
  fileName: string
}

interface LogoState {
  src: string
  name: string
}

const DEFAULT_FORM_DATA: QrcodeFormData = {
  content: 'https://github.com',
  size: 256,
  marginSize: 2,
  level: 'H',
  fgColor: '#000000',
  bgColor: '#ffffff',
  transparentBg: false,
  logoSize: 22,
  logoExcavate: true,
  fileName: 'qrcode'
}

const QR_PRESETS = [
  {
    key: 'url',
    value: 'https://daily-tools.vercel.app'
  },
  {
    key: 'email',
    value: 'mailto:hello@example.com?subject=Hello&body=Generated%20from%20Daily%20Tools'
  },
  {
    key: 'phone',
    value: 'tel:+8613800138000'
  },
  {
    key: 'sms',
    value: 'sms:+8613800138000?body=Hello%20from%20Daily%20Tools'
  },
  {
    key: 'wifi',
    value: 'WIFI:T:WPA;S:DailyTools;P:password123;;'
  },
  {
    key: 'vcard',
    value:
      'BEGIN:VCARD\nVERSION:3.0\nFN:Daily Tools\nORG:Daily Tools\nEMAIL:hello@example.com\nURL:https://daily-tools.vercel.app\nEND:VCARD'
  },
  {
    key: 'geo',
    value: 'geo:31.2304,121.4737?q=Shanghai'
  },
  {
    key: 'event',
    value:
      'BEGIN:VEVENT\nSUMMARY:Daily Tools Demo\nDTSTART:20260605T090000Z\nDTEND:20260605T093000Z\nLOCATION:Online\nEND:VEVENT'
  }
] as const

const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const
const MAX_LOGO_SIZE = 1024 * 1024

const checkerboardStyle = {
  backgroundColor: 'rgba(255,255,255,0.18)',
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.5) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.5) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.5) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.5) 75%)',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundSize: '16px 16px'
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const sanitizeFileName = (value: string) => {
  const sanitized = value
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return sanitized || 'qrcode'
}

const getPayloadDensity = (bytes: number) => {
  if (bytes <= 256) return 'compact'
  if (bytes <= 900) return 'balanced'
  return 'dense'
}

const getPayloadType = (value: string) => {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  if (/^https?:\/\//i.test(trimmed)) return 'url'
  if (lower.startsWith('mailto:')) return 'email'
  if (lower.startsWith('tel:')) return 'phone'
  if (lower.startsWith('sms:')) return 'sms'
  if (lower.startsWith('wifi:')) return 'wifi'
  if (lower.startsWith('geo:')) return 'geo'
  if (lower.includes('begin:vcard')) return 'vcard'
  if (lower.includes('begin:vevent')) return 'event'
  return 'text'
}

const serializeSvg = (svg: SVGSVGElement) => new XMLSerializer().serializeToString(svg)

const QrcodeClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const qrRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [formData, setFormData] = useState<QrcodeFormData>(DEFAULT_FORM_DATA)
  const [logo, setLogo] = useState<LogoState | null>(null)

  const qrValue = useMemo(() => formData.content.trim(), [formData.content])
  const hasContent = qrValue.length > 0
  const payloadBytes = useMemo(() => new TextEncoder().encode(qrValue).length, [qrValue])
  const payloadDensity = getPayloadDensity(payloadBytes)
  const payloadType = getPayloadType(qrValue)
  const safeFileName = sanitizeFileName(formData.fileName)
  const bgColor = formData.transparentBg ? 'transparent' : formData.bgColor
  const logoPixelSize = Math.round(formData.size * (formData.logoSize / 100))

  const imageSettings = useMemo(() => {
    if (!logo || !hasContent) return undefined

    return {
      src: logo.src,
      width: logoPixelSize,
      height: logoPixelSize,
      excavate: formData.logoExcavate
    }
  }, [formData.logoExcavate, hasContent, logo, logoPixelSize])

  const qrProps = useMemo(
    () => ({
      value: qrValue,
      size: formData.size,
      fgColor: formData.fgColor,
      bgColor,
      level: formData.level,
      marginSize: formData.marginSize,
      boostLevel: true,
      title: t('app.generation.qrcode.preview'),
      imageSettings
    }),
    [
      bgColor,
      formData.fgColor,
      formData.level,
      formData.marginSize,
      formData.size,
      imageSettings,
      qrValue,
      t
    ]
  )

  const handleApplyPreset = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, content: value }))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
    setLogo(null)
  }, [])

  const handleLogoFiles = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) {
        toast.warning(t('app.generation.qrcode.logo_too_large'))
        return
      }

      if (!file.type.startsWith('image/')) {
        toast.warning(t('app.generation.qrcode.logo_invalid'))
        return
      }

      if (file.size > MAX_LOGO_SIZE) {
        toast.warning(t('app.generation.qrcode.logo_too_large'))
        return
      }

      try {
        const src = await readFileAsDataUrl(file)
        setLogo({ src, name: file.name })
        setFormData(prev => ({
          ...prev,
          level: prev.level === 'L' || prev.level === 'M' ? 'H' : prev.level
        }))
        toast.success(t('public.success'))
      } catch {
        toast.error(t('public.error'))
      }
    },
    [toast, t]
  )

  const handleDownload = useCallback(() => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      toast.error(t('public.generate_failed'))
      return
    }
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `${safeFileName}.png`
    link.href = url
    link.click()
    toast.success(t('public.success'))
  }, [hasContent, safeFileName, toast, t])

  const handleDownloadSvg = useCallback(() => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    const svg = svgRef.current
    if (!svg) {
      toast.error(t('public.generate_failed'))
      return
    }

    const source = serializeSvg(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${safeFileName}.svg`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('public.success'))
  }, [hasContent, safeFileName, toast, t])

  const handleCopyPngDataUrl = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      toast.error(t('public.generate_failed'))
      return
    }

    try {
      await navigator.clipboard.writeText(canvas.toDataURL('image/png'))
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [hasContent, toast, t])

  const handleCopySvg = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    const svg = svgRef.current
    if (!svg) {
      toast.error(t('public.generate_failed'))
      return
    }

    try {
      await navigator.clipboard.writeText(serializeSvg(svg))
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [hasContent, toast, t])

  const handleCopyPayload = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    try {
      await navigator.clipboard.writeText(qrValue)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [hasContent, qrValue, toast, t])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('app.generation.qrcode')}</CardTitle>
              <CardDescription>{t('app.generation.qrcode.description')}</CardDescription>
            </div>
            <Button
              variant="default"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="content">{t('app.generation.qrcode.content')}</Label>
                <Textarea
                  id="content"
                  rows={6}
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder={t('app.generation.qrcode.content_placeholder')}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {QR_PRESETS.map(preset => (
                  <Button
                    key={preset.key}
                    type="button"
                    size="sm"
                    variant="default"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => handleApplyPreset(preset.value)}
                  >
                    {t(`app.generation.qrcode.preset.${preset.key}`)}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="glass-panel glass-clip rounded-2xl p-4">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('app.generation.qrcode.bytes')}
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                    {payloadBytes}
                  </div>
                </div>
                <div className="glass-panel glass-clip rounded-2xl p-4">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('app.generation.qrcode.density')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.qrcode.density.${payloadDensity}`)}
                  </div>
                </div>
                <div className="glass-panel glass-clip rounded-2xl p-4">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('app.generation.qrcode.payload_type')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.qrcode.type.${payloadType}`)}
                  </div>
                </div>
                <div className="glass-panel glass-clip rounded-2xl p-4">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('app.generation.qrcode.logo_coverage')}
                  </div>
                  <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                    {logo ? `${formData.logoSize}%` : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label>
                    {t('app.generation.qrcode.size')}: {formData.size}px
                  </Label>
                  <Slider
                    value={formData.size}
                    min={128}
                    max={640}
                    step={8}
                    onChange={value => setFormData(prev => ({ ...prev, size: value }))}
                  />
                </div>
                <div className="space-y-3">
                  <Label>
                    {t('app.generation.qrcode.margin')}: {formData.marginSize}
                  </Label>
                  <Slider
                    value={formData.marginSize}
                    min={0}
                    max={8}
                    step={1}
                    onChange={value => setFormData(prev => ({ ...prev, marginSize: value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(180px,0.9fr)_1fr]">
                <div className="space-y-3">
                  <Label htmlFor="level">{t('app.generation.qrcode.level')}</Label>
                  <Select
                    id="level"
                    value={formData.level}
                    onChange={event =>
                      setFormData(prev => ({
                        ...prev,
                        level: event.target.value as ErrorCorrectionLevel
                      }))
                    }
                  >
                    {QR_LEVELS.map(level => (
                      <option key={level} value={level}>
                        {t(`app.generation.qrcode.level.${level}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="fileName">{t('app.generation.qrcode.file_name')}</Label>
                  <Input
                    id="fileName"
                    value={formData.fileName}
                    onChange={event =>
                      setFormData(prev => ({ ...prev, fileName: event.target.value }))
                    }
                    placeholder="qrcode"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="fgColor">{t('app.generation.qrcode.fgColor')}</Label>
                  <ColorPicker
                    id="fgColor"
                    value={formData.fgColor}
                    onChange={value => setFormData(prev => ({ ...prev, fgColor: value }))}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="bgColor">{t('app.generation.qrcode.bgColor')}</Label>
                  <ColorPicker
                    id="bgColor"
                    value={formData.bgColor}
                    disabled={formData.transparentBg}
                    onChange={value => setFormData(prev => ({ ...prev, bgColor: value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={formData.transparentBg ? 'primary' : 'default'}
                  onClick={() =>
                    setFormData(prev => ({ ...prev, transparentBg: !prev.transparentBg }))
                  }
                >
                  {t('app.generation.qrcode.transparent_bg')}
                </Button>
                <Button
                  type="button"
                  variant={formData.logoExcavate ? 'primary' : 'default'}
                  disabled={!logo}
                  onClick={() =>
                    setFormData(prev => ({ ...prev, logoExcavate: !prev.logoExcavate }))
                  }
                >
                  {t('app.generation.qrcode.logo_excavate')}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Button
                  type="button"
                  variant="primary"
                  icon={<FileImage className="h-4 w-4" />}
                  disabled={!hasContent}
                  onClick={handleDownload}
                >
                  {t('app.generation.qrcode.download_png')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<FileCode2 className="h-4 w-4" />}
                  disabled={!hasContent}
                  onClick={handleDownloadSvg}
                >
                  {t('app.generation.qrcode.download_svg')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!hasContent}
                  onClick={handleCopyPngDataUrl}
                >
                  {t('app.generation.qrcode.copy_data_url')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!hasContent}
                  onClick={handleCopySvg}
                >
                  {t('app.generation.qrcode.copy_svg')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!hasContent}
                  onClick={handleCopyPayload}
                >
                  {t('app.generation.qrcode.copy_payload')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex min-h-[420px] flex-col">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('app.generation.qrcode.preview')}</CardTitle>
              <CardDescription>
                {hasContent
                  ? t('app.generation.qrcode.preview_hint', {
                      size: formData.size,
                      margin: formData.marginSize,
                      level: formData.level
                    })
                  : t('app.generation.qrcode.empty')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 sm:p-6">
              {hasContent ? (
                <div
                  ref={qrRef}
                  className="glass-panel glass-shimmer glass-caustic glass-clip relative rounded-[2rem] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)] sm:p-6"
                >
                  <div className="space-y-3">
                    <div
                      className="rounded-[1.35rem] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_40px_rgba(0,0,0,0.18)]"
                      style={
                        formData.transparentBg ? checkerboardStyle : { backgroundColor: bgColor }
                      }
                    >
                      <QRCodeCanvas {...qrProps} />
                    </div>
                    <QRCodeSVG ref={svgRef} {...qrProps} className="hidden" />
                  </div>
                </div>
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                  <div className="glass-panel glass-shimmer glass-clip flex h-16 w-16 items-center justify-center rounded-2xl">
                    <QrCode className="h-8 w-8 text-[var(--text-secondary)]" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-[var(--text-primary)]">
                      {t('app.generation.qrcode.empty_title')}
                    </p>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      {t('app.generation.qrcode.empty_description')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.qrcode.logo')}</CardTitle>
            <CardDescription>{t('app.generation.qrcode.logo_description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUploadZone
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              maxSize={MAX_LOGO_SIZE}
              onChange={handleLogoFiles}
              className="min-h-36 rounded-2xl p-5"
            >
              <ImagePlus className="h-8 w-8 text-[var(--text-tertiary)]" />
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t('app.generation.qrcode.logo_upload')}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {t('app.generation.qrcode.logo_hint')}
                </p>
              </div>
            </FileUploadZone>

            {logo && (
              <div className="glass-panel glass-clip flex items-center gap-3 rounded-2xl p-3">
                <Image
                  src={logo.src}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded-xl object-contain"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {logo.name}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {t('app.generation.qrcode.logo_size')}: {logoPixelSize}px
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setLogo(null)}
                  aria-label={t('app.generation.qrcode.logo_remove')}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>
                {t('app.generation.qrcode.logo_size')}: {formData.logoSize}%
              </Label>
              <Slider
                value={formData.logoSize}
                min={10}
                max={32}
                step={1}
                disabled={!logo}
                onChange={value => setFormData(prev => ({ ...prev, logoSize: value }))}
              />
            </div>

            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              {t('app.generation.qrcode.logo_note')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default QrcodeClient
