'use client'
import type { JsExcelPreview } from '@js-preview/excel'
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'
import { formatPreviewFileSize } from './previewGuards'

interface PreviewFileInfo {
  lastModified: number
  name: string
  size: number
}

interface ExcelPreviewOptions {
  maxCols?: number
  maxRows?: number
  minColLength?: number
  minRowLength?: number
  showContextmenu?: boolean
}

const MAX_EXCEL_SIZE = 25 * 1024 * 1024
const MAX_EXCEL_PREVIEW_COLUMNS = 80
const MAX_EXCEL_PREVIEW_ROWS = 2000

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
  const [previewLimited, setPreviewLimited] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (excelRef.current && !isInitialized.current) {
        try {
          const { default: jsPreviewExcel } = await import('@js-preview/excel')
          await import('@js-preview/excel/lib/index.css')
          myExcelPreviewer.current = jsPreviewExcel.init(excelRef.current, {
            maxCols: MAX_EXCEL_PREVIEW_COLUMNS,
            maxRows: MAX_EXCEL_PREVIEW_ROWS,
            minColLength: 12,
            minRowLength: 40,
            showContextmenu: false
          } as ExcelPreviewOptions)
          isInitialized.current = true
        } catch (e) {
          console.error('ExcelPreviewer init error:', e)
          setError(t('app.preview.file.preview_failed'))
          setLoading(false)
        }
      }
      if (isInitialized.current && previewUrl) {
        myExcelPreviewer.current
          ?.preview(previewUrl)
          .then(() => {
            setError('')
            setPreviewLimited(true)
          })
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
      setError(t('app.preview.file.too_large', { size: formatPreviewFileSize(MAX_EXCEL_SIZE) }))
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
    setPreviewLimited(false)
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
    setPreviewLimited(false)
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
            accept=".xlsx,.xls"
            onUpload={onUpload}
            disabled={loading}
            tip={t('app.preview.file.tip', {
              size: formatPreviewFileSize(MAX_EXCEL_SIZE),
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
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
          {error && (
            <p className="mb-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          {previewLimited && (
            <p className="mb-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.preview.file.sheet_limited', {
                columns: MAX_EXCEL_PREVIEW_COLUMNS,
                rows: MAX_EXCEL_PREVIEW_ROWS
              })}
            </p>
          )}
          <div className="glass-panel glass-clip relative flex-1 overflow-auto rounded-lg">
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
