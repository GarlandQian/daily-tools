'use client'
import { UploadOutlined } from '@ant-design/icons'
import type { JsExcelPreview } from '@js-preview/excel'
import { Button,Flex, Spin, Upload } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
      {!hasFile ? (
        <FileUploader accept=".xlsx" onUpload={onUpload} disabled={loading} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '0 0 10px 0' }}>
            <Upload
              accept=".xlsx"
              showUploadList={false}
              customRequest={({ file, onSuccess }) => {
                setTimeout(() => {
                  onSuccess?.('ok')
                  onUpload(file as RcFile)
                }, 0)
              }}
            >
              <Button icon={<UploadOutlined />} loading={loading}>
                {t('app.encryption.aes.action')}
              </Button>
            </Upload>
          </div>
          <div style={{ overflow: 'auto', flex: 1, position: 'relative', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <Spin
              spinning={loading}
              style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
            />
            <div style={{ height: '100%' }} ref={excelRef}></div>
          </div>
        </div>
      )}
    </Flex>
  )
}

export default ExcelPreviewer
