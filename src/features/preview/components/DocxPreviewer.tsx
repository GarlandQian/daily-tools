'use client'
import type { JsDocxPreview } from '@js-preview/docx'
import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

const DocxPreviewer = () => {
  const { t } = useTranslation()
  const myDocxPreviewer = useRef<JsDocxPreview | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
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
          .catch(e => console.error('Docx Preview Error:', e))
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
      myDocxPreviewer.current?.destroy()
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
        <FileUploader accept=".docx" onUpload={onUpload} disabled={loading} />
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="pb-3">
            <Button
              icon={<Upload className="w-4 h-4" />}
              loading={loading}
              onClick={() => document.getElementById('docx-reupload')?.click()}
            >
              {t('public.upload_again')}
            </Button>
            <input
              id="docx-reupload"
              type="file"
              accept=".docx"
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
            <div className="h-full" ref={docxRef}></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocxPreviewer
