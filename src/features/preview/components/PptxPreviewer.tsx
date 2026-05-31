'use client'
import { Upload } from 'lucide-react'
import type jsPreviewPPtx from 'pptx-preview'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import FileUploader from './FileUploader'

const PptxPreviewer = () => {
  const { t } = useTranslation()
  const myPPtxPreviewer = useRef<ReturnType<typeof jsPreviewPPtx.init> | null>(null)
  const pptxRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
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
        myPPtxPreviewer.current?.preview(previewBuffer).finally(() => {
          setLoading(false)
        })
      }
    }
    if (hasFile) {
      init()
    }
  }, [hasFile, previewBuffer])

  useEffect(() => {
    return () => {
      myPPtxPreviewer.current?.dom
        .querySelectorAll('.pptx-preview-wrapper')
        .forEach(e => e.remove())
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: File) => {
    setLoading(true)
    setHasFile(true)
    const reader = new FileReader()
    reader.onload = function (event) {
      const arrayBuffer = event.target?.result as ArrayBuffer
      setPreviewBuffer(arrayBuffer)
    }
    reader.readAsArrayBuffer(file)
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
        <FileUploader accept=".pptx" onUpload={onUpload} disabled={loading} />
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="pb-3">
            <Button
              icon={<Upload className="w-4 h-4" />}
              loading={loading}
              onClick={() => document.getElementById('pptx-reupload')?.click()}
            >
              {t('app.encryption.aes.action')}
            </Button>
            <input
              id="pptx-reupload"
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={handleReupload}
            />
          </div>
          <div className="flex-1 overflow-hidden relative glass-panel rounded-lg">
            {loading && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
              </div>
            )}
            <div className="h-full" ref={pptxRef}></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PptxPreviewer
