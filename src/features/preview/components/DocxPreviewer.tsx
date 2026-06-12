'use client'
import type { JsDocxPreview } from '@js-preview/docx'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

interface PreviewFileInfo {
  lastModified: number
  name: string
  size: number
}

const previewFileNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const MAX_DOCX_SIZE = 25 * 1024 * 1024

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${previewFileNumberFormatter.format(bytes / 1024)} KB`
  return `${previewFileNumberFormatter.format(bytes / (1024 * 1024))} MB`
}

const DocxPreviewer = () => {
  const { t } = useTranslation()
  const myDocxPreviewer = useRef<JsDocxPreview | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState<PreviewFileInfo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (docxRef.current && !isInitialized.current) {
        const { default: jsPreviewDocx } = await import('@js-preview/docx')
        await import('@js-preview/docx/lib/index.css')
        myDocxPreviewer.current = jsPreviewDocx.init(docxRef.current)
        isInitialized.current = true
      }
      if (isInitialized.current && previewUrl) {
        myDocxPreviewer.current
          ?.preview(previewUrl)
          .then(() => setError(''))
          .catch(e => {
            console.error('Docx Preview Error:', e)
            setError(t('app.preview.file.preview_failed'))
          })
          .finally(() => {
            setLoading(false)
          })
      }
    }
    if (hasFile) {
      init()
    }
  }, [hasFile, previewUrl, t])

  useEffect(() => {
    return () => {
      myDocxPreviewer.current?.destroy()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError(t('app.preview.file.invalid_type', { type: '.docx' }))
      return
    }

    if (file.size > MAX_DOCX_SIZE) {
      setError(t('app.preview.file.too_large', { size: formatFileSize(MAX_DOCX_SIZE) }))
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setLoading(true)
    setHasFile(true)
    setError('')
    setFileInfo({
      lastModified: file.lastModified,
      name: file.name,
      size: file.size
    })
    setPreviewUrl(url)
  }

  const handleReupload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onUpload(file)
      event.target.value = ''
    }
  }

  const handleClear = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    docxRef.current?.replaceChildren()
    setError('')
    setFileInfo(null)
    setHasFile(false)
    setLoading(false)
    setPreviewUrl(null)
  }

  const handleDownload = () => {
    if (!previewUrl || !fileInfo) return
    const anchor = document.createElement('a')
    anchor.href = previewUrl
    anchor.download = fileInfo.name
    anchor.click()
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {!hasFile ? (
        <div className="space-y-3">
          <FileUploader
            accept=".docx"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.file.tip', { size: formatFileSize(MAX_DOCX_SIZE), type: '.docx' })}
          />
          {error && (
            <p className="rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
            {fileInfo && (
              <div className="glass-panel glass-clip min-w-0 rounded-xl px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]">
                    {fileInfo.name}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {formatFileSize(fileInfo.size)} ·{' '}
                  {new Date(fileInfo.lastModified).toLocaleString()}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<Upload className="w-4 h-4" />}
                loading={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('public.upload_again')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                disabled={!previewUrl}
                onClick={handleDownload}
              >
                {t('app.preview.file.download')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleClear}
              >
                {t('app.preview.file.remove')}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
          {error && (
            <p className="mb-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="glass-panel glass-clip relative flex-1 overflow-auto rounded-lg">
            {loading && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
              </div>
            )}
            <div className="h-full" ref={docxRef}></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocxPreviewer
