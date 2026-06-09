'use client'

import type { JsPdfPreview } from '@js-preview/pdf'
import { Download, FileText, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

const MAX_PDF_SIZE = 50 * 1024 * 1024

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

const getFileExtension = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

const PdfPreviewer = () => {
  const { t } = useTranslation()
  const myPdfPreviewer = useRef<JsPdfPreview | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [fileInfo, setFileInfo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (pdfRef.current && !isInitialized.current) {
        const { default: jsPreviewPdf } = await import('@js-preview/pdf')
        myPdfPreviewer.current = jsPreviewPdf.init(pdfRef.current, {
          onError: () => {
            setLoading(false)
            setError(t('app.preview.pdf.preview_error'))
          },
          onRendered: () => {
            setLoading(false)
            setError(null)
          }
        })
        isInitialized.current = true
      }

      if (isInitialized.current && previewUrl) {
        myPdfPreviewer.current
          ?.preview(previewUrl)
          .catch(() => setError(t('app.preview.pdf.preview_error')))
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
      myPdfPreviewer.current?.destroy()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    const extension = getFileExtension(file.name)
    if (extension !== 'pdf' && file.type !== 'application/pdf') {
      setError(t('app.preview.pdf.invalid_type'))
      return
    }

    if (file.size > MAX_PDF_SIZE) {
      setError(
        t('app.preview.pdf.too_large', {
          size: formatBytes(MAX_PDF_SIZE)
        })
      )
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setError(null)
    setFileInfo(file)
    setLoading(true)
    setHasFile(true)
    setPreviewUrl(url)
  }

  const handleReupload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onUpload(file)
      event.target.value = ''
    }
  }

  const handleRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    myPdfPreviewer.current?.destroy()
    myPdfPreviewer.current = null
    isInitialized.current = false
    setHasFile(false)
    setLoading(false)
    setPreviewUrl(null)
    setFileInfo(null)
    setError(null)
  }

  const handleDownload = () => {
    if (!previewUrl || !fileInfo) return
    const anchor = document.createElement('a')
    anchor.href = previewUrl
    anchor.download = fileInfo.name
    anchor.click()
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {!hasFile ? (
        <div className="grid h-full min-h-[520px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <FileUploader accept=".pdf" onUpload={onUpload} disabled={loading} />
          <div className="glass-panel glass-clip rounded-3xl p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.preview.pdf.local_only')}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {t('app.preview.pdf.local_hint', { size: formatBytes(MAX_PDF_SIZE) })}
            </p>
            {error && (
              <p className="mt-4 rounded-2xl bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
                {error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="pb-3">
            <div className="glass-panel glass-clip rounded-3xl p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {fileInfo?.name ?? t('app.preview.pdf.unknown_file')}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo ? formatBytes(fileInfo.size) : '-'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo?.type || 'application/pdf'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {t('app.preview.pdf.max_size', { size: formatBytes(MAX_PDF_SIZE) })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    icon={<Upload className="h-4 w-4" />}
                    loading={loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('public.upload_again')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={<Download className="h-4 w-4" />}
                    disabled={!previewUrl}
                    onClick={handleDownload}
                  >
                    {t('app.preview.pdf.download')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={handleRemove}
                  >
                    {t('public.clear')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleReupload}
                  />
                </div>
              </div>
              {error && (
                <p className="mt-3 rounded-2xl bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
                  {error}
                </p>
              )}
            </div>
          </div>
          <div className="glass-panel glass-clip relative flex-1 overflow-auto rounded-3xl">
            {loading && (
              <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </div>
            )}
            {!loading && error && (
              <div className="absolute inset-x-4 top-5 z-10 rounded-2xl bg-[var(--error-subtle)] px-4 py-3 text-sm text-[var(--error)]">
                {error}
              </div>
            )}
            <div className="h-full" ref={pdfRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfPreviewer
