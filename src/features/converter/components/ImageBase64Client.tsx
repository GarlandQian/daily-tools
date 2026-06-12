'use client'

import { Code2, Copy, Download, FileImage, ImageIcon, RotateCcw, Upload } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUploadZone } from '@/components/ui/file-upload'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type OutputFormat = 'dataUri' | 'base64' | 'css' | 'html' | 'markdown'

interface FileInfo {
  base64Length: number
  dataUri: string
  height: number
  name: string
  previewUrl: string
  size: number
  type: string
  width: number
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
const IMAGE_OUTPUT_PREVIEW_CHARS = 60000
const imageNumberFormatter = new Intl.NumberFormat()

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatImageNumber = (value: number) => imageNumberFormatter.format(value)

const getImageDimensions = (src: string) =>
  new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      resolve({ height: image.naturalHeight, width: image.naturalWidth })
    }
    image.onerror = reject
    image.src = src
  })

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => resolve(String(event.target?.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const buildOutput = (fileInfo: FileInfo | null, format: OutputFormat, includeDataUri: boolean) => {
  if (!fileInfo) return ''
  const commaIndex = fileInfo.dataUri.indexOf(',')
  const rawBase64 = commaIndex >= 0 ? fileInfo.dataUri.slice(commaIndex + 1) : fileInfo.dataUri
  const dataUri = includeDataUri ? fileInfo.dataUri : rawBase64

  if (format === 'base64') return rawBase64
  if (format === 'css') return `background-image: url("${fileInfo.dataUri}");`
  if (format === 'html') {
    return `<img src="${fileInfo.dataUri}" alt="${fileInfo.name}" width="${fileInfo.width}" height="${fileInfo.height}" />`
  }
  if (format === 'markdown') return `![${fileInfo.name}](${fileInfo.dataUri})`
  return dataUri
}

const getOutputMeta = (fileInfo: FileInfo | null, format: OutputFormat) => {
  const rawName = fileInfo?.name.replace(/\.[^.]+$/, '') || 'daily-tools-image'
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const filenameBase = safeName || 'daily-tools-image'

  if (format === 'css') return { filename: `${filenameBase}.css`, type: 'text/css;charset=utf-8' }
  if (format === 'html')
    return { filename: `${filenameBase}.html`, type: 'text/html;charset=utf-8' }
  if (format === 'markdown')
    return { filename: `${filenameBase}.md`, type: 'text/markdown;charset=utf-8' }
  return { filename: `${filenameBase}.txt`, type: 'text/plain;charset=utf-8' }
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

const buildOutputPreview = (
  fileInfo: FileInfo | null,
  format: OutputFormat,
  includeDataUri: boolean
) => {
  if (!fileInfo) return { text: '', totalLength: 0, visibleLength: 0 }

  const commaIndex = fileInfo.dataUri.indexOf(',')
  const base64Start = commaIndex >= 0 ? commaIndex + 1 : 0
  const rawBase64Length = fileInfo.base64Length

  if (format === 'base64') {
    const preview = fileInfo.dataUri.slice(base64Start, base64Start + IMAGE_OUTPUT_PREVIEW_CHARS)
    return {
      text: rawBase64Length > IMAGE_OUTPUT_PREVIEW_CHARS ? `${preview}...` : preview,
      totalLength: rawBase64Length,
      visibleLength: Math.min(rawBase64Length, IMAGE_OUTPUT_PREVIEW_CHARS)
    }
  }

  if (format === 'dataUri') {
    const source = includeDataUri ? fileInfo.dataUri : fileInfo.dataUri.slice(base64Start)
    const totalLength = includeDataUri ? fileInfo.dataUri.length : rawBase64Length
    return {
      text:
        totalLength > IMAGE_OUTPUT_PREVIEW_CHARS
          ? `${source.slice(0, IMAGE_OUTPUT_PREVIEW_CHARS)}...`
          : source,
      totalLength,
      visibleLength: Math.min(totalLength, IMAGE_OUTPUT_PREVIEW_CHARS)
    }
  }

  const prefix =
    format === 'css'
      ? 'background-image: url("'
      : format === 'html'
        ? '<img src="'
        : `![${fileInfo.name}](`
  const suffix =
    format === 'css'
      ? '");'
      : format === 'html'
        ? `" alt="${fileInfo.name}" width="${fileInfo.width}" height="${fileInfo.height}" />`
        : ')'
  const totalLength = prefix.length + fileInfo.dataUri.length + suffix.length

  if (totalLength <= IMAGE_OUTPUT_PREVIEW_CHARS) {
    return {
      text: `${prefix}${fileInfo.dataUri}${suffix}`,
      totalLength,
      visibleLength: totalLength
    }
  }

  const dataUriPreviewLength = Math.max(0, IMAGE_OUTPUT_PREVIEW_CHARS - prefix.length - 3)
  return {
    text: `${prefix}${fileInfo.dataUri.slice(0, dataUriPreviewLength)}...`,
    totalLength,
    visibleLength: IMAGE_OUTPUT_PREVIEW_CHARS
  }
}

const ImageBase64Client = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const previewUrlRef = useRef<string | null>(null)
  const uploadTokenRef = useRef(0)

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [includeDataUri, setIncludeDataUri] = useState(true)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('dataUri')

  const outputPreview = useMemo(
    () => buildOutputPreview(fileInfo, outputFormat, includeDataUri),
    [fileInfo, includeDataUri, outputFormat]
  )
  const isOutputPreviewLimited = outputPreview.totalLength > outputPreview.visibleLength
  const outputMeta = useMemo(() => getOutputMeta(fileInfo, outputFormat), [fileInfo, outputFormat])

  const stats = useMemo(() => {
    if (!fileInfo) {
      return [
        { label: t('app.converter.image.stats.file_size'), value: '-' },
        { label: t('app.converter.image.stats.base64_size'), value: '-' },
        { label: t('app.converter.image.stats.dimensions'), value: '-' },
        { label: t('app.converter.image.stats.expansion'), value: '-' }
      ]
    }

    const base64Bytes = fileInfo.base64Length
    const expansion = Math.round((base64Bytes / fileInfo.size) * 100)

    return [
      { label: t('app.converter.image.stats.file_size'), value: formatSize(fileInfo.size) },
      { label: t('app.converter.image.stats.base64_size'), value: formatSize(base64Bytes) },
      {
        label: t('app.converter.image.stats.dimensions'),
        value: `${fileInfo.width} x ${fileInfo.height}`
      },
      { label: t('app.converter.image.stats.expansion'), value: `${expansion}%` }
    ]
  }, [fileInfo, t])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const handleFileChange = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error(t('app.converter.image.select_image'))
        return
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error(t('app.converter.image.too_large', { size: formatSize(MAX_IMAGE_SIZE_BYTES) }))
        return
      }

      const uploadToken = uploadTokenRef.current + 1
      uploadTokenRef.current = uploadToken
      let previewUrl: string | null = null

      try {
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = null
        }
        previewUrl = URL.createObjectURL(file)
        previewUrlRef.current = previewUrl
        const dataUri = await readFileAsDataUrl(file)
        if (uploadTokenRef.current !== uploadToken) {
          URL.revokeObjectURL(previewUrl)
          return
        }
        const dimensions = await getImageDimensions(previewUrl)
        if (uploadTokenRef.current !== uploadToken) {
          URL.revokeObjectURL(previewUrl)
          return
        }
        const rawBase64 = dataUri.split(',')[1] || dataUri

        setFileInfo({
          base64Length: rawBase64.length,
          dataUri,
          height: dimensions.height,
          name: file.name,
          previewUrl,
          size: file.size,
          type: file.type,
          width: dimensions.width
        })
      } catch {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
        if (uploadTokenRef.current === uploadToken && previewUrlRef.current === previewUrl) {
          previewUrlRef.current = null
          toast.error(t('public.generate_failed'))
        }
      }
    },
    [toast, t]
  )

  const handleClear = () => {
    uploadTokenRef.current += 1
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setFileInfo(null)
  }

  const handleCopyOutput = () => {
    const output = buildOutput(fileInfo, outputFormat, includeDataUri)
    if (output) void copy(output)
  }

  const handleDownloadOutput = () => {
    const output = buildOutput(fileInfo, outputFormat, includeDataUri)
    if (!output) return
    downloadText(output, outputMeta.filename, outputMeta.type)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.image')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.converter.image.description', { size: formatSize(MAX_IMAGE_SIZE_BYTES) })}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleClear}
              disabled={!fileInfo}
            >
              {t('public.clear')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileUploadZone
            accept="image/*"
            maxSize={MAX_IMAGE_SIZE_BYTES}
            onChange={handleFileChange}
          >
            <Upload className="h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {t('app.converter.image.upload')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{t('app.converter.image.hint')}</p>
          </FileUploadZone>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(item => (
              <div key={item.label} className="glass-input rounded-xl p-3">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          {fileInfo && (
            <div className="flex flex-wrap gap-2">
              <ImageChip label={t('app.converter.image.filename')} value={fileInfo.name} />
              <ImageChip label={t('app.converter.image.type')} value={fileInfo.type} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
        <Card className="flex min-h-[320px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.image.preview')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center">
            {fileInfo ? (
              <div className="glass-input flex max-h-[420px] w-full items-center justify-center overflow-hidden rounded-xl p-3">
                <Image
                  src={fileInfo.previewUrl}
                  alt={fileInfo.name}
                  width={fileInfo.width}
                  height={fileInfo.height}
                  unoptimized
                  className="h-auto max-h-[380px] w-auto max-w-full rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--text-tertiary)]">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm">{t('app.converter.image.no_image')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[320px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code2 className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.converter.image.output')}
                </CardTitle>
                <CardDescription className="mt-2">
                  {t('app.converter.image.output_hint')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={handleCopyOutput}
                  disabled={!fileInfo}
                >
                  {t('public.copy')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleDownloadOutput}
                  disabled={!fileInfo}
                >
                  {t('app.converter.image.download')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-3">
                <Label htmlFor="image-output-format">
                  {t('app.converter.image.output_format')}
                </Label>
                <Select
                  id="image-output-format"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  <option value="dataUri">{t('app.converter.image.format.data_uri')}</option>
                  <option value="base64">{t('app.converter.image.format.base64')}</option>
                  <option value="css">{t('app.converter.image.format.css')}</option>
                  <option value="html">{t('app.converter.image.format.html')}</option>
                  <option value="markdown">{t('app.converter.image.format.markdown')}</option>
                </Select>
              </div>
              <Checkbox
                checked={includeDataUri}
                onChange={event => setIncludeDataUri(event.target.checked)}
                disabled={outputFormat !== 'dataUri'}
                label={t('app.converter.image.include_data_uri')}
                className="self-end"
              />
            </div>

            <Textarea
              value={outputPreview.text}
              readOnly
              placeholder={t('app.converter.image.base64_placeholder')}
              className="min-h-[260px] flex-1 resize-none font-mono text-xs"
            />
            {isOutputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.image.preview_limited', {
                  total: formatImageNumber(outputPreview.totalLength),
                  visible: formatImageNumber(outputPreview.visibleLength)
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const ImageChip = ({ label, value }: { label: string; value: string }) => (
  <span className="glass-panel inline-flex items-center gap-1.5 rounded-full border border-[var(--border-base)] px-3 py-1.5 text-xs">
    <span className="text-[var(--text-tertiary)]">{label}:</span>
    <span className="font-mono font-medium text-[var(--text-primary)]">{value}</span>
  </span>
)

export default ImageBase64Client
