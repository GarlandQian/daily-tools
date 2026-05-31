'use client'

import type { JsPdfPreview } from '@js-preview/pdf'
import { Upload } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

const PdfPreviewer = () => {
  const { t } = useTranslation()
  const myPdfPreviewer = useRef<JsPdfPreview | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (pdfRef.current && !isInitialized.current) {
        const { default: jsPreviewPdf } = await import('@js-preview/pdf')
        myPdfPreviewer.current = jsPreviewPdf.init(pdfRef.current, {
          onError: () => {
            setLoading(false)
          },
          onRendered: () => {
            setLoading(false)
          }
        })
        isInitialized.current = true
      }

      if (isInitialized.current && previewUrl) {
        myPdfPreviewer.current
          ?.preview(previewUrl)
          .catch(error => console.error('Pdf Preview Error:', error))
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
      myPdfPreviewer.current?.destroy()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
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

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {!hasFile ? (
        <FileUploader accept=".pdf" onUpload={onUpload} disabled={loading} />
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="pb-3">
            <Button
              type="button"
              icon={<Upload className="h-4 w-4" />}
              loading={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('app.encryption.aes.action')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
          <div className="glass-panel relative flex-1 overflow-auto rounded-lg">
            {loading && (
              <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
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
