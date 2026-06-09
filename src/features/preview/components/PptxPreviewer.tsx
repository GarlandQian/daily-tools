'use client'
import { Download, FileText, ShieldCheck, Trash2, Upload } from 'lucide-react'
import type jsPreviewPPtx from 'pptx-preview'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

interface PreviewFileInfo {
  lastModified: number
  name: string
  size: number
  type: string
}

const previewFileNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const MAX_PPTX_SIZE = 60 * 1024 * 1024

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${previewFileNumberFormatter.format(bytes / 1024)} KB`
  return `${previewFileNumberFormatter.format(bytes / (1024 * 1024))} MB`
}

const PptxPreviewer = () => {
  const { t } = useTranslation()
  const myPPtxPreviewer = useRef<ReturnType<typeof jsPreviewPPtx.init> | null>(null)
  const pptxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
  const [fileInfo, setFileInfo] = useState<PreviewFileInfo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (pptxRef.current && !isInitialized.current) {
        const { init } = await import('pptx-preview')
        myPPtxPreviewer.current = init(pptxRef.current, {
          width: '100%' as unknown as number,
          height: 700
        })
        isInitialized.current = true
      }
      if (isInitialized.current && previewBuffer) {
        myPPtxPreviewer.current
          ?.preview(previewBuffer)
          .then(() => setError(''))
          .catch(() => setError(t('app.preview.pptx.preview_error')))
          .finally(() => {
            setLoading(false)
          })
      }
    }
    if (hasFile) {
      init()
    }
  }, [hasFile, previewBuffer, t])

  useEffect(() => {
    return () => {
      myPPtxPreviewer.current?.dom
        .querySelectorAll('.pptx-preview-wrapper')
        .forEach(e => e.remove())
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setError(t('app.preview.pptx.invalid_type'))
      return
    }

    if (file.size > MAX_PPTX_SIZE) {
      setError(t('app.preview.pptx.too_large', { size: formatFileSize(MAX_PPTX_SIZE) }))
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setLoading(true)
    setHasFile(true)
    setError('')
    setFileInfo({
      lastModified: file.lastModified,
      name: file.name,
      size: file.size,
      type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    })
    setPreviewUrl(objectUrl)
    const reader = new FileReader()
    reader.onload = function (event) {
      const arrayBuffer = event.target?.result as ArrayBuffer
      setPreviewBuffer(arrayBuffer)
    }
    reader.onerror = function () {
      setLoading(false)
      setError(t('app.preview.pptx.preview_error'))
    }
    reader.readAsArrayBuffer(file)
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
    myPPtxPreviewer.current?.dom
      .querySelectorAll('.pptx-preview-wrapper')
      .forEach(element => element.remove())
    setError('')
    setFileInfo(null)
    setHasFile(false)
    setLoading(false)
    setPreviewBuffer(null)
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
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {!hasFile ? (
        <div className="grid h-full min-h-[520px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <FileUploader
            accept=".pptx"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.pptx.tip', { size: formatFileSize(MAX_PPTX_SIZE) })}
          />
          <div className="glass-panel glass-clip rounded-3xl p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.preview.pptx.local_only')}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {t('app.preview.pptx.local_hint', { size: formatFileSize(MAX_PPTX_SIZE) })}
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
                      {fileInfo?.name ?? t('app.preview.pptx.unknown_file')}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo ? formatFileSize(fileInfo.size) : '-'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo?.type ||
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo ? new Date(fileInfo.lastModified).toLocaleString() : '-'}
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
                    {t('app.preview.pptx.download')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={handleClear}
                  >
                    {t('public.clear')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pptx"
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
            <div className="h-full" ref={pptxRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PptxPreviewer
