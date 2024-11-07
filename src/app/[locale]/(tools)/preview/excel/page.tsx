'use client'
import { useEffect, useRef, useState } from 'react'
import jsPreviewExcel, { JsExcelPreview } from '@js-preview/excel'
import '@js-preview/excel/lib/index.css'
import { Button, Flex, Spin, Upload } from 'antd'
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
      <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden', marginRight: '-20px' }}>
        <Flex>
          <Upload action="/" maxCount={1} showUploadList={false} onChange={onChange} accept=".docx">
            <Button>Click to Upload</Button>
          </Upload>
        </Flex>
        <div style={{ overflow: 'auto', flex: 1, paddingRight: '10px' }}>
          <Spin spinning={loading}></Spin>
          <div style={{ height: '100%' }} ref={excelRef}></div>
        </div>
      </Flex>
    </>
  )
}

export default ExcelPerview
