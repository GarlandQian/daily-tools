'use client'
import type { JsExcelPreview } from '@js-preview/excel'
import { FileSpreadsheet, Trash2, Upload } from 'lucide-react'
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
const MAX_EXCEL_SIZE = 25 * 1024 * 1024

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${previewFileNumberFormatter.format(bytes / 1024)} KB`
  return `${previewFileNumberFormatter.format(bytes / (1024 * 1024))} MB`
}

const ExcelPreviewer = () => {
  const { t } = useTranslation()
  const myExcelPreviewer = useRef<JsExcelPreview | null>(null)
  const excelRef = useRef<HTMLDivElement>(null)
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
      if (excelRef.current && !isInitialized.current) {
        try {
          const { default: jsPreviewExcel } = await import('@js-preview/excel')
          await import('@js-preview/excel/lib/index.css')
          myExcelPreviewer.current = jsPreviewExcel.init(excelRef.current)
          isInitialized.current = true
        } catch (e) {
          console.error('ExcelPreviewer init error:', e)
        }
      }
      if (isInitialized.current && previewUrl) {
        myExcelPreviewer.current
          ?.preview(previewUrl)
          .then(() => setError(''))
          .catch(error => {
            console.error('Preview Error:', error)
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
      myExcelPreviewer.current?.destroy()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError(t('app.preview.file.invalid_type', { type: '.xlsx, .xls' }))
      return
    }

    if (file.size > MAX_EXCEL_SIZE) {
      setError(t('app.preview.file.too_large', { size: formatFileSize(MAX_EXCEL_SIZE) }))
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
    excelRef.current?.replaceChildren()
    setError('')
    setFileInfo(null)
    setHasFile(false)
    setLoading(false)
    setPreviewUrl(null)
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {!hasFile ? (
        <div className="space-y-3">
          <FileUploader
            accept=".xlsx,.xls"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.file.tip', {
              size: formatFileSize(MAX_EXCEL_SIZE),
              type: '.xlsx, .xls'
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
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--primary)]" />
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
              accept=".xlsx"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
          {error && (
            <p className="mb-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex-1 overflow-auto relative glass-panel rounded-lg">
            {loading && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
              </div>
            )}
            <div className="h-full" ref={excelRef}></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExcelPreviewer
