'use client'
import type { JsExcelPreview } from '@js-preview/excel'
import { Flex, Spin } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'

import FileUploader from '../../components/FileUploader'

const ExcelPreviewer = () => {
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
          // @ts-expect-error CSS import not resolved by TS
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

  const onUpload = (file: RcFile) => {
    const url = URL.createObjectURL(file)
    setLoading(true)
    setHasFile(true)
    setPreviewUrl(url)
  }

  return (
    <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden' }}>
      <FileUploader accept=".xlsx" onUpload={onUpload} disabled={loading} />
      {hasFile && (
        <div style={{ overflow: 'auto', flex: 1, position: 'relative' }}>
          <Spin
            spinning={loading}
            style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
          />
          <div style={{ height: '100%' }} ref={excelRef}></div>
        </div>
      )}
    </Flex>
  )
}

export default ExcelPreviewer
