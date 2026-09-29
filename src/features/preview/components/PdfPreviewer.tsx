'use client'

import { Download, FileText, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useLocalFilePreview } from '../hooks/useLocalFilePreview'
import { MAX_PDF_SIZE, pdfPreviewFormat } from '../lib/previewFormats'
import FileUploader from './FileUploader'
import { formatPreviewFileSize } from './previewGuards'

const PdfPreviewer = () => {
  const { t } = useTranslation()
  const {
    containerRef,
    fileInputRef,
    fileInfo,
    hasFile,
    loading,
    error,
    result: previewLimit,
    onUpload,
    handleReupload,
    handleClear,
    handleDownload
  } = useLocalFilePreview(pdfPreviewFormat, {
    invalidType: t('app.preview.pdf.invalid_type'),
    tooLarge: t('app.preview.pdf.too_large', { size: formatPreviewFileSize(MAX_PDF_SIZE) }),
    previewFailed: t('app.preview.pdf.preview_error')
  })

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {!hasFile ? (
        <div className="grid h-full min-h-[520px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <FileUploader
            accept=".pdf"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.pdf.tip', { size: formatPreviewFileSize(MAX_PDF_SIZE) })}
          />
          <div className="glass-panel glass-clip rounded-3xl p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.preview.pdf.local_only')}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {t('app.preview.pdf.local_hint', { size: formatPreviewFileSize(MAX_PDF_SIZE) })}
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
                      {fileInfo ? formatPreviewFileSize(fileInfo.size) : '-'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {fileInfo?.type || 'application/pdf'}
                    </span>
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-1">
                      {t('app.preview.pdf.max_size', {
                        size: formatPreviewFileSize(MAX_PDF_SIZE)
                      })}
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
                    disabled={!fileInfo}
                    onClick={handleDownload}
                  >
                    {t('app.preview.pdf.download')}
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
              {previewLimit && (
                <p className="mt-3 rounded-2xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.preview.pdf.pages_limited', {
                    total: previewLimit.total,
                    visible: previewLimit.visible
                  })}
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
            <div className="h-full" ref={containerRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfPreviewer
