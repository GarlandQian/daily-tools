'use client'

import { Copy, FileCode2, FileImage, QrCode, RefreshCw, Sparkles } from 'lucide-react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
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
}

const DEFAULT_FORM_DATA: QrcodeFormData = {
  content: 'https://github.com',
  size: 256,
  marginSize: 2,
  level: 'H',
  fgColor: '#000000',
  bgColor: '#ffffff'
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
  }
] as const

const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const

const QrcodeClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const qrRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [formData, setFormData] = useState<QrcodeFormData>(DEFAULT_FORM_DATA)

  const qrValue = useMemo(() => formData.content.trim(), [formData.content])
  const hasContent = qrValue.length > 0

  const qrProps = useMemo(
    () => ({
      value: qrValue,
      size: formData.size,
      fgColor: formData.fgColor,
      bgColor: formData.bgColor,
      level: formData.level,
      marginSize: formData.marginSize,
      boostLevel: true,
      title: t('app.generation.qrcode.preview')
    }),
    [
      formData.bgColor,
      formData.fgColor,
      formData.level,
      formData.marginSize,
      formData.size,
      qrValue,
      t
    ]
  )

  const handleApplyPreset = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, content: value }))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
  }, [])

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
    link.download = 'qrcode.png'
    link.href = url
    link.click()
    toast.success(t('public.success'))
  }, [hasContent, toast, t])

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

    const source = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'qrcode.svg'
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('public.success'))
  }, [hasContent, toast, t])

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

  return (
    <div className="size-full flex flex-col gap-5">
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-3">
              <Label htmlFor="content">{t('app.generation.qrcode.content')}</Label>
              <Textarea
                id="content"
                rows={5}
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder={t('app.generation.qrcode.content_placeholder')}
              />
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
                    max={512}
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
                <div className="grid grid-cols-2 gap-4">
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
                      onChange={value => setFormData(prev => ({ ...prev, bgColor: value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
                  className="col-span-2 md:col-span-1"
                >
                  {t('app.generation.qrcode.copy_data_url')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
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
        <CardContent>
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 sm:p-6">
            {hasContent ? (
              <div
                ref={qrRef}
                className="glass-panel glass-shimmer glass-caustic glass-clip relative rounded-[2rem] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)] sm:p-6"
              >
                <div className="space-y-3">
                  <div className="rounded-[1.35rem] bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_40px_rgba(0,0,0,0.18)]">
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
    </div>
  )
}

export default QrcodeClient
