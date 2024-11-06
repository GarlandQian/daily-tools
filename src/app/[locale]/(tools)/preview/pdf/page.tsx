'use client'
import { useEffect, useRef, useState } from 'react'
import jsPreviewPdf, { JsPdfPreview } from '@js-preview/pdf'
import { Button, Spin, Upload } from 'antd'
import { UploadChangeParam } from 'antd/es/upload'

const ExcelPerview = () => {
  const myPdfPreviewer = useRef<JsPdfPreview | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pdfRef.current) {
      myPdfPreviewer.current = jsPreviewPdf.init(pdfRef.current, {
        onError: () => {
          setLoading(false)
        },
        onRendered: () => {
          setLoading(false)
        },
      })
    }

    return () => {
      myPdfPreviewer.current?.destroy()
    }
  }, [])

  const onChange = ({ file }: UploadChangeParam) => {
    if (file.status === 'done' && file.originFileObj) {
      const url = URL.createObjectURL(file.originFileObj)
      setLoading(true)
      myPdfPreviewer.current?.preview(url)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' }}>
        <Upload action="/" maxCount={1} showUploadList={false} onChange={onChange} accept=".pdf">
          <Button>Click to Upload</Button>
        </Upload>

        <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
          <Spin spinning={loading}></Spin>
          <div ref={pdfRef} style={{ height: '100%' }}></div>
        </div>
      </div>
    </>
  )
}

export default ExcelPerview
