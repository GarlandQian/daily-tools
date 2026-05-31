'use client'
import type { JsExcelPreview } from '@js-preview/excel'
import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

const ExcelPreviewer = () => {
  const { t } = useTranslation()
  const myExcelPreviewer = useRef<JsExcelPreview | null>(null)
  const excelRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
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
          .catch(error => {
            console.error('Preview Error:', error)
          })
          .finally(() => {
            setLoading(false)
          })
      }
    }
    if (hasFile) {
      init()
    }
  }, [hasFile, previewUrl])

  useEffect(() => {
    return () => {
      myExcelPreviewer.current?.destroy()
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    const url = URL.createObjectURL(file)
    setLoading(true)
    setHasFile(true)
    setPreviewUrl(url)
  }

  const handleReupload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {!hasFile ? (
        <FileUploader accept=".xlsx" onUpload={onUpload} disabled={loading} />
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="pb-3">
            <Button
              icon={<Upload className="w-4 h-4" />}
              loading={loading}
              onClick={() => document.getElementById('excel-reupload')?.click()}
            >
              {t('app.encryption.aes.action')}
            </Button>
            <input
              id="excel-reupload"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
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
