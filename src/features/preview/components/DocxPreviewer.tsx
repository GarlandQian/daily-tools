'use client'
import { UploadOutlined } from '@ant-design/icons'
import type { JsDocxPreview } from '@js-preview/docx'
import { Button,Flex, Spin, Upload } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
        // @ts-expect-error CSS import not resolved by TS
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

  const onUpload = (file: RcFile) => {
    const url = URL.createObjectURL(file)
    setLoading(true)
    setHasFile(true)
    setPreviewUrl(url)
  }

  return (
    <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden' }}>
      {!hasFile ? (
        <FileUploader accept=".docx" onUpload={onUpload} disabled={loading} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '0 0 10px 0' }}>
            <Upload
              accept=".docx"
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
            <div style={{ height: '100%' }} ref={docxRef}></div>
          </div>
        </div>
      )}
    </Flex>
  )
}

export default DocxPreviewer
