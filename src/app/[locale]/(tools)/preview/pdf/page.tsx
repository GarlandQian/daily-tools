'use client'
import jsPreviewPdf, { JsPdfPreview } from '@js-preview/pdf'
import { Button, Flex, Spin, Upload } from 'antd'
import { UploadChangeParam } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'

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
        }
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
      <Flex
        gap="middle"
        vertical
        style={{ height: '100%', overflow: 'hidden', marginRight: '-20px' }}
      >
        <Flex>
          <Upload action="/" maxCount={1} showUploadList={false} onChange={onChange} accept=".pdf">
            <Button>Click to Upload</Button>
          </Upload>
        </Flex>
        <div style={{ overflow: 'auto', flex: 1, paddingRight: '10px' }}>
          <Spin spinning={loading}></Spin>
          <div style={{ height: '100%' }} ref={pdfRef}></div>
        </div>
      </Flex>
    </>
  )
}

export default ExcelPerview
