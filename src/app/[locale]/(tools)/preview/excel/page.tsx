'use client'
import { useEffect, useRef, useState } from 'react'
import jsPreviewExcel, { JsExcelPreview } from '@js-preview/excel'
import '@js-preview/excel/lib/index.css'
import { Button, Spin, Upload } from 'antd'
import { UploadChangeParam } from 'antd/es/upload'

const ExcelPerview = () => {
  const myExcelPreviewer = useRef<JsExcelPreview | null>(null)
  const excelRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (excelRef.current) {
      myExcelPreviewer.current = jsPreviewExcel.init(excelRef.current)
    }

    return () => {
      myExcelPreviewer.current?.destroy()
    }
  }, [])

  const onChange = ({ file }: UploadChangeParam) => {
    if (file.status === 'done' && file.originFileObj) {
      const url = URL.createObjectURL(file.originFileObj)
      setLoading(true)
      myExcelPreviewer?.current
        ?.preview(url)
        .catch((error) => {
          console.error('Preview Error:', error) // 处理预览错误
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' }}>
        <Upload action="/" maxCount={1} showUploadList={false} onChange={onChange} accept=".xlsx">
          <Button>Click to Upload</Button>
        </Upload>

        <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
          <Spin spinning={loading}></Spin>
          <div ref={excelRef} style={{ height: '100%' }}></div>
        </div>
      </div>
    </>
  )
}

export default ExcelPerview
