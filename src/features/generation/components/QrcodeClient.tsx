'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FileImage,
  ImagePlus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
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

import type { QrcodeRendererProps } from './QrcodeRenderer'

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'
type FindingLevel = 'danger' | 'good' | 'warn'

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

interface QrFinding {
  key: string
  level: FindingLevel
  subject: string
}

interface PayloadSummary {
  chars: number
  destination: string
  lines: number
  scheme: string
  type: string
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

const DynamicQrcodeRenderer = dynamic<QrcodeRendererProps>(
  () => import('./QrcodeRenderer').then(module => module.QrcodeRenderer),
  {
    loading: () => (
      <div
        aria-hidden="true"
        className="flex size-64 items-center justify-center rounded-[1.35rem] border border-[var(--glass-border)] bg-[var(--glass-input-bg)]"
      >
        <QrCode className="h-10 w-10 animate-pulse text-[var(--text-tertiary)]" />
      </div>
    ),
    ssr: false
  }
)

const QR_LEVELS = ['L', 'M', 'Q', 'H'] as const
const MAX_LOGO_SIZE = 1024 * 1024
const MAX_QR_CONTENT_CHARS = 12000
const QR_LEVEL_BYTE_LIMITS: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273
}
const LARGE_PAYLOAD_WARNING_BYTES = 900
const MIN_CONTRAST_RATIO = 4.5
const qrNumberFormatter = new Intl.NumberFormat()

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

const getPayloadSummary = (value: string): PayloadSummary => {
  const trimmed = value.trim()
  const type = getPayloadType(trimmed)
  const summary: PayloadSummary = {
    chars: trimmed.length,
    destination: '',
    lines: trimmed ? trimmed.split(/\r?\n/u).length : 0,
    scheme: '',
    type
  }

  if (!trimmed) return summary

  try {
    const url = new URL(trimmed)
    summary.scheme = url.protocol.replace(/:$/u, '')
    summary.destination = url.hostname || url.pathname
    return summary
  } catch {
    // Non-URL payloads are parsed below.
  }

  if (type === 'wifi') {
    summary.scheme = 'wifi'
    summary.destination = trimmed.match(/(?:^|;)S:([^;]*)/iu)?.[1] ?? ''
    return summary
  }

  if (type === 'vcard') {
    summary.scheme = 'vcard'
    summary.destination = trimmed.match(/^FN:(.+)$/imu)?.[1]?.trim() ?? ''
    return summary
  }

  if (type === 'event') {
    summary.scheme = 'event'
    summary.destination = trimmed.match(/^SUMMARY:(.+)$/imu)?.[1]?.trim() ?? ''
    return summary
  }

  summary.destination = trimmed.slice(0, 64)
  return summary
}

const hexToRgb = (value: string) => {
  const hex = value.trim().replace(/^#/u, '')
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map(char => `${char}${char}`)
          .join('')
      : hex
  if (!/^[\da-f]{6}$/iu.test(expanded)) return null
  const numberValue = Number.parseInt(expanded, 16)

  return {
    b: numberValue & 255,
    g: (numberValue >> 8) & 255,
    r: (numberValue >> 16) & 255
  }
}

const getRelativeLuminance = (value: string) => {
  const rgb = hexToRgb(value)
  if (!rgb) return null
  const channel = (component: number) => {
    const normalized = component / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

const getContrastRatio = (foreground: string, background: string, transparent: boolean) => {
  if (transparent) return null
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  if (foregroundLuminance === null || backgroundLuminance === null) return null
  const light = Math.max(foregroundLuminance, backgroundLuminance)
  const dark = Math.min(foregroundLuminance, backgroundLuminance)

  return (light + 0.05) / (dark + 0.05)
}

const hasUrlCredentials = (value: string) => {
  try {
    const url = new URL(value.trim())
    return Boolean(url.username || url.password)
  } catch {
    return false
  }
}

const isHttpUrl = (value: string) => /^https?:\/\//iu.test(value.trim())

const buildQrFindings = ({
  canRender,
  contrastRatio,
  formData,
  hasLogo,
  payloadBytes,
  payloadSummary,
  renderLimit
}: {
  canRender: boolean
  contrastRatio: number | null
  formData: QrcodeFormData
  hasLogo: boolean
  payloadBytes: number
  payloadSummary: PayloadSummary
  renderLimit: number
}) => {
  const findings: QrFinding[] = []
  const value = formData.content.trim()

  if (!value) findings.push({ key: 'empty', level: 'danger', subject: 'payload' })
  if (payloadBytes > renderLimit)
    findings.push({
      key: 'too_large_for_level',
      level: 'danger',
      subject: `${payloadBytes}/${renderLimit}`
    })
  if (payloadBytes > LARGE_PAYLOAD_WARNING_BYTES && payloadBytes <= renderLimit)
    findings.push({ key: 'dense_payload', level: 'warn', subject: `${payloadBytes} bytes` })
  if (contrastRatio !== null && contrastRatio < MIN_CONTRAST_RATIO)
    findings.push({ key: 'low_contrast', level: 'danger', subject: contrastRatio.toFixed(2) })
  if (formData.marginSize < 2)
    findings.push({ key: 'quiet_zone_low', level: 'warn', subject: String(formData.marginSize) })
  if (hasLogo && formData.level !== 'H')
    findings.push({ key: 'logo_needs_high_correction', level: 'warn', subject: formData.level })
  if (hasLogo && formData.logoSize > 28)
    findings.push({ key: 'logo_too_large', level: 'warn', subject: `${formData.logoSize}%` })
  if (hasLogo && !formData.logoExcavate)
    findings.push({ key: 'logo_not_excavated', level: 'warn', subject: 'logo' })
  if (isHttpUrl(value) && value.toLowerCase().startsWith('http://'))
    findings.push({ key: 'url_not_https', level: 'warn', subject: value.slice(0, 96) })
  if (hasUrlCredentials(value))
    findings.push({ key: 'url_credentials', level: 'danger', subject: value.slice(0, 96) })
  if (payloadSummary.type === 'wifi' && !/;P:[^;]+/iu.test(value))
    findings.push({
      key: 'wifi_missing_password',
      level: 'warn',
      subject: payloadSummary.destination || 'Wi-Fi'
    })
  if (payloadSummary.type === 'vcard' && !/^FN:.+/imu.test(value))
    findings.push({ key: 'vcard_missing_name', level: 'warn', subject: 'FN' })
  if (payloadSummary.type === 'event' && !/^DTSTART:.+/imu.test(value))
    findings.push({ key: 'event_missing_start', level: 'warn', subject: 'DTSTART' })
  if (canRender && findings.length === 0)
    findings.push({
      key: 'ready',
      level: 'good',
      subject: payloadSummary.destination || payloadSummary.type
    })

  return findings
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: QrFinding[]) =>
  [
    ['level', 'key', 'subject'].map(csvCell).join(','),
    ...findings.map(finding => [finding.level, finding.key, finding.subject].map(csvCell).join(','))
  ].join('\n')

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

const serializeSvg = (svg: SVGSVGElement) => new XMLSerializer().serializeToString(svg)

const QrcodeClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const qrRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [formData, setFormData] = useState<QrcodeFormData>(DEFAULT_FORM_DATA)
  const [isContentTruncated, setIsContentTruncated] = useState(false)
  const [isQrRendererReady, setIsQrRendererReady] = useState(false)
  const [logo, setLogo] = useState<LogoState | null>(null)
  const deferredFormData = useDeferredValue(formData)

  const payloadValue = useMemo(() => formData.content.trim(), [formData.content])
  const qrValue = useMemo(() => deferredFormData.content.trim(), [deferredFormData.content])
  const hasContent = payloadValue.length > 0
  const previewHasContent = qrValue.length > 0
  const currentPayloadBytes = useMemo(
    () => new TextEncoder().encode(payloadValue).length,
    [payloadValue]
  )
  const payloadBytes = useMemo(() => new TextEncoder().encode(qrValue).length, [qrValue])
  const currentRenderLimit = QR_LEVEL_BYTE_LIMITS[formData.level]
  const previewRenderLimit = QR_LEVEL_BYTE_LIMITS[deferredFormData.level]
  const canExportQr = hasContent && currentPayloadBytes <= currentRenderLimit
  const canRenderQr = previewHasContent && payloadBytes <= previewRenderLimit
  const payloadDensity = getPayloadDensity(payloadBytes)
  const payloadType = getPayloadType(qrValue)
  const safeFileName = sanitizeFileName(formData.fileName)
  const payloadSummary = useMemo(() => getPayloadSummary(qrValue), [qrValue])
  const contrastRatio = useMemo(
    () =>
      getContrastRatio(
        deferredFormData.fgColor,
        deferredFormData.bgColor,
        deferredFormData.transparentBg
      ),
    [deferredFormData.bgColor, deferredFormData.fgColor, deferredFormData.transparentBg]
  )
  const findings = useMemo(
    () =>
      buildQrFindings({
        canRender: canRenderQr,
        contrastRatio,
        formData: deferredFormData,
        hasLogo: Boolean(logo),
        payloadBytes,
        payloadSummary,
        renderLimit: previewRenderLimit
      }),
    [
      canRenderQr,
      contrastRatio,
      deferredFormData,
      logo,
      payloadBytes,
      payloadSummary,
      previewRenderLimit
    ]
  )
  const findingsCsv = useMemo(() => buildFindingsCsv(findings), [findings])
  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        {
          bytes: payloadBytes,
          contrastRatio: contrastRatio === null ? null : Number(contrastRatio.toFixed(2)),
          fileName: safeFileName,
          findings,
          limit: previewRenderLimit,
          payload: payloadSummary,
          settings: {
            level: deferredFormData.level,
            logo: Boolean(logo),
            logoCoverage: logo ? `${deferredFormData.logoSize}%` : null,
            margin: deferredFormData.marginSize,
            size: deferredFormData.size
          }
        },
        null,
        2
      ),
    [
      contrastRatio,
      deferredFormData.level,
      deferredFormData.logoSize,
      deferredFormData.marginSize,
      deferredFormData.size,
      findings,
      logo,
      payloadBytes,
      payloadSummary,
      previewRenderLimit,
      safeFileName
    ]
  )
  const bgColor = deferredFormData.transparentBg ? 'transparent' : deferredFormData.bgColor
  const logoPixelSize = Math.round(formData.size * (formData.logoSize / 100))
  const previewLogoPixelSize = Math.round(deferredFormData.size * (deferredFormData.logoSize / 100))

  const imageSettings = useMemo(() => {
    if (!logo || !canRenderQr) return undefined

    return {
      src: logo.src,
      width: previewLogoPixelSize,
      height: previewLogoPixelSize,
      excavate: deferredFormData.logoExcavate
    }
  }, [canRenderQr, deferredFormData.logoExcavate, logo, previewLogoPixelSize])

  const qrProps = useMemo(
    () => ({
      value: qrValue,
      size: deferredFormData.size,
      fgColor: deferredFormData.fgColor,
      bgColor,
      level: deferredFormData.level,
      marginSize: deferredFormData.marginSize,
      boostLevel: true,
      title: t('app.generation.qrcode.preview'),
      imageSettings
    }),
    [
      bgColor,
      deferredFormData.fgColor,
      deferredFormData.level,
      deferredFormData.marginSize,
      deferredFormData.size,
      imageSettings,
      qrValue,
      t
    ]
  )

  const handleQrRendererReady = useCallback(() => {
    setIsQrRendererReady(true)
  }, [])

  const setContentValue = useCallback((value: string) => {
    const isTruncated = value.length > MAX_QR_CONTENT_CHARS
    setIsContentTruncated(isTruncated)
    setFormData(prev => ({
      ...prev,
      content: isTruncated ? value.slice(0, MAX_QR_CONTENT_CHARS) : value
    }))
  }, [])

  const handleApplyPreset = useCallback((value: string) => {
    setIsContentTruncated(false)
    setFormData(prev => ({ ...prev, content: value }))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
    setIsContentTruncated(false)
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

    if (!canExportQr) {
      toast.warning(
        t('app.generation.qrcode.too_large', {
          bytes: currentPayloadBytes,
          level: formData.level,
          limit: currentRenderLimit
        })
      )
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
  }, [
    canExportQr,
    currentPayloadBytes,
    currentRenderLimit,
    formData.level,
    hasContent,
    safeFileName,
    toast,
    t
  ])

  const handleDownloadSvg = useCallback(() => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    if (!canExportQr) {
      toast.warning(
        t('app.generation.qrcode.too_large', {
          bytes: currentPayloadBytes,
          level: formData.level,
          limit: currentRenderLimit
        })
      )
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
  }, [
    canExportQr,
    currentPayloadBytes,
    currentRenderLimit,
    formData.level,
    hasContent,
    safeFileName,
    toast,
    t
  ])

  const handleCopyPngDataUrl = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    if (!canExportQr) {
      toast.warning(
        t('app.generation.qrcode.too_large', {
          bytes: currentPayloadBytes,
          level: formData.level,
          limit: currentRenderLimit
        })
      )
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
  }, [canExportQr, currentPayloadBytes, currentRenderLimit, formData.level, hasContent, toast, t])

  const handleCopySvg = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    if (!canExportQr) {
      toast.warning(
        t('app.generation.qrcode.too_large', {
          bytes: currentPayloadBytes,
          level: formData.level,
          limit: currentRenderLimit
        })
      )
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
  }, [canExportQr, currentPayloadBytes, currentRenderLimit, formData.level, hasContent, toast, t])

  const handleCopyPayload = useCallback(async () => {
    if (!hasContent) {
      toast.warning(t('app.generation.qrcode.empty'))
      return
    }

    try {
      await navigator.clipboard.writeText(payloadValue)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [hasContent, payloadValue, toast, t])

  const handleCopyAuditCsv = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(findingsCsv)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [findingsCsv, toast, t])

  const handleCopyPayloadJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(payloadJson)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [payloadJson, toast, t])

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
                  onChange={e => setContentValue(e.target.value)}
                  placeholder={t('app.generation.qrcode.content_placeholder')}
                />
                {isContentTruncated && (
                  <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                    {t('app.generation.qrcode.warning.content_truncated', {
                      limit: qrNumberFormatter.format(MAX_QR_CONTENT_CHARS)
                    })}
                  </p>
                )}
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
                  disabled={!canExportQr || !isQrRendererReady}
                  onClick={handleDownload}
                >
                  {t('app.generation.qrcode.download_png')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<FileCode2 className="h-4 w-4" />}
                  disabled={!canExportQr || !isQrRendererReady}
                  onClick={handleDownloadSvg}
                >
                  {t('app.generation.qrcode.download_svg')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!canExportQr || !isQrRendererReady}
                  onClick={handleCopyPngDataUrl}
                >
                  {t('app.generation.qrcode.copy_data_url')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!canExportQr || !isQrRendererReady}
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
                {hasContent && !canExportQr
                  ? t('app.generation.qrcode.too_large', {
                      bytes: currentPayloadBytes,
                      level: formData.level,
                      limit: currentRenderLimit
                    })
                  : hasContent
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
              {previewHasContent && canRenderQr ? (
                <div
                  ref={qrRef}
                  className="glass-panel glass-shimmer glass-caustic glass-clip relative rounded-[2rem] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)] sm:p-6"
                >
                  <div className="space-y-3">
                    <div
                      className="rounded-[1.35rem] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_40px_rgba(0,0,0,0.18)]"
                      style={
                        deferredFormData.transparentBg
                          ? checkerboardStyle
                          : { backgroundColor: bgColor }
                      }
                    >
                      <DynamicQrcodeRenderer
                        {...qrProps}
                        svgRef={svgRef}
                        onReady={handleQrRendererReady}
                      />
                    </div>
                  </div>
                </div>
              ) : previewHasContent ? (
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                  <div className="glass-panel glass-shimmer glass-clip flex h-16 w-16 items-center justify-center rounded-2xl">
                    <AlertTriangle className="h-8 w-8 text-[var(--warning)]" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-[var(--text-primary)]">
                      {t('app.generation.qrcode.too_large_title')}
                    </p>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      {t('app.generation.qrcode.too_large', {
                        bytes: payloadBytes,
                        level: deferredFormData.level,
                        limit: previewRenderLimit
                      })}
                    </p>
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

        <div className="space-y-5">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.qrcode.scan_audit')}
              </CardTitle>
              <CardDescription>{t('app.generation.qrcode.scan_audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <QrMetric
                  label={t('app.generation.qrcode.metric.limit')}
                  value={`${payloadBytes}/${previewRenderLimit}`}
                />
                <QrMetric
                  label={t('app.generation.qrcode.metric.contrast')}
                  value={contrastRatio === null ? '-' : contrastRatio.toFixed(2)}
                />
                <QrMetric
                  label={t('app.generation.qrcode.metric.lines')}
                  value={payloadSummary.lines}
                />
                <QrMetric
                  label={t('app.generation.qrcode.metric.destination')}
                  value={payloadSummary.destination || '-'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  onClick={handleCopyAuditCsv}
                >
                  {t('app.generation.qrcode.copy_audit_csv')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() =>
                    downloadText(findingsCsv, `${safeFileName}-audit.csv`, 'text/csv;charset=utf-8')
                  }
                >
                  {t('app.generation.qrcode.download_audit_csv')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<FileCode2 className="h-4 w-4" />}
                  onClick={handleCopyPayloadJson}
                >
                  {t('app.generation.qrcode.copy_payload_json')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() =>
                    downloadText(
                      payloadJson,
                      `${safeFileName}-payload.json`,
                      'application/json;charset=utf-8'
                    )
                  }
                >
                  {t('app.generation.qrcode.download_payload_json')}
                </Button>
              </div>

              <div className="space-y-2">
                {findings.map(finding => (
                  <QrFindingRow
                    key={`${finding.key}-${finding.subject}`}
                    finding={finding}
                    label={t(`app.generation.qrcode.audit.${finding.key}`)}
                    levelLabel={t(`app.generation.qrcode.level.${finding.level}`)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const QrMetric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <p className="truncate text-xs font-medium text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-2 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const getFindingColorClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const QrFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: QrFinding
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

export default QrcodeClient
