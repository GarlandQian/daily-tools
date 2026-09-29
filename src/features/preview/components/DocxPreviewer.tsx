'use client'

import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useLocalFilePreview } from '../hooks/useLocalFilePreview'
import { docxPreviewFormat, MAX_DOCX_SIZE } from '../lib/previewFormats'
import FileUploader from './FileUploader'
import { formatPreviewFileSize } from './previewGuards'

const DocxPreviewer = () => {
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
  } = useLocalFilePreview(docxPreviewFormat, {
    invalidType: t('app.preview.file.invalid_type', { type: '.docx' }),
    tooLarge: t('app.preview.file.too_large', { size: formatPreviewFileSize(MAX_DOCX_SIZE) }),
    previewFailed: t('app.preview.file.preview_failed')
  })

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {!hasFile ? (
        <div className="space-y-3">
          <FileUploader
            accept=".docx"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.file.tip', {
              size: formatPreviewFileSize(MAX_DOCX_SIZE),
              type: '.docx'
            })}
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
                  {formatPreviewFileSize(fileInfo.size)} ·{' '}
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
                disabled={!fileInfo}
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
          {previewLimit && (
            <p className="mb-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.preview.file.pages_limited', {
                total: previewLimit.total,
                visible: previewLimit.visible
              })}
            </p>
          )}
          <div className="glass-panel glass-clip relative flex-1 overflow-auto rounded-lg">
            {loading && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
              </div>
            )}
            <div className="h-full" ref={containerRef}></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocxPreviewer
