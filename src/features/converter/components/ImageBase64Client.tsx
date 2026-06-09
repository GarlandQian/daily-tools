'use client'

import { Code2, Copy, FileImage, ImageIcon, RotateCcw, Upload } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useMemo, useState } from 'react'
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
  size: number
  type: string
  width: number
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

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
  const rawBase64 = fileInfo.dataUri.split(',')[1] || fileInfo.dataUri
  const dataUri = includeDataUri ? fileInfo.dataUri : rawBase64

  if (format === 'base64') return rawBase64
  if (format === 'css') return `background-image: url("${fileInfo.dataUri}");`
  if (format === 'html') {
    return `<img src="${fileInfo.dataUri}" alt="${fileInfo.name}" width="${fileInfo.width}" height="${fileInfo.height}" />`
  }
  if (format === 'markdown') return `![${fileInfo.name}](${fileInfo.dataUri})`
  return dataUri
}

const ImageBase64Client = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [includeDataUri, setIncludeDataUri] = useState(true)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('dataUri')

  const output = useMemo(
    () => buildOutput(fileInfo, outputFormat, includeDataUri),
    [fileInfo, includeDataUri, outputFormat]
  )

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

      try {
        const dataUri = await readFileAsDataUrl(file)
        const dimensions = await getImageDimensions(dataUri)
        const rawBase64 = dataUri.split(',')[1] || dataUri

        setFileInfo({
          base64Length: rawBase64.length,
          dataUri,
          height: dimensions.height,
          name: file.name,
          size: file.size,
          type: file.type,
          width: dimensions.width
        })
      } catch {
        toast.error(t('public.generate_failed'))
      }
    },
    [toast, t]
  )

  const handleClear = () => {
    setFileInfo(null)
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
                  src={fileInfo.dataUri}
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
              <Button
                type="button"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('public.copy')}
              </Button>
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
              value={output}
              readOnly
              placeholder={t('app.converter.image.base64_placeholder')}
              className="min-h-[260px] flex-1 resize-none font-mono text-xs"
            />
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
