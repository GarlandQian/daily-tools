'use client'
import type { JsPdfPreview } from '@js-preview/pdf'
import { Flex, Spin } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'

import FileUploader from '../../components/FileUploader'

const PdfPreviewer = () => {
  const myPdfPreviewer = useRef<JsPdfPreview | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (pdfRef.current) {
        const { default: jsPreviewPdf } = await import('@js-preview/pdf')
        myPdfPreviewer.current = jsPreviewPdf.init(pdfRef.current, {
          onError: () => {
            setLoading(false)
          },
          onRendered: () => {
            setLoading(false)
          }
        })
      }
    }
    init()

    return () => {
      myPdfPreviewer.current?.destroy()
    }
  }, [])

  const onUpload = (file: RcFile) => {
    const url = URL.createObjectURL(file)
    setLoading(true)
    myPdfPreviewer.current?.preview(url)
  }

  return (
    <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden' }}>
      <FileUploader accept=".pdf" onUpload={onUpload} disabled={loading} />
      <div style={{ overflow: 'auto', flex: 1, position: 'relative' }}>
        <Spin spinning={loading} style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />
        <div style={{ height: '100%' }} ref={pdfRef}></div>
      </div>
    </Flex>
  )
}

export default PdfPreviewer
