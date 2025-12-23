'use client'
import { UploadOutlined } from '@ant-design/icons'
import type { JsPdfPreview } from '@js-preview/pdf'
import { Button,Flex, Spin, Upload } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import FileUploader from './FileUploader'

const PdfPreviewer = () => {
  const { t } = useTranslation()
  const myPdfPreviewer = useRef<JsPdfPreview | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (pdfRef.current && !isInitialized.current) {
        const { default: jsPreviewPdf } = await import('@js-preview/pdf')
        myPdfPreviewer.current = jsPreviewPdf.init(pdfRef.current, {
          onError: () => {
            setLoading(false)
          },
          onRendered: () => {
            setLoading(false)
          }
        })
        isInitialized.current = true
      }
      if (isInitialized.current && previewUrl) {
        myPdfPreviewer.current
          ?.preview(previewUrl)
          .catch(e => console.error('Pdf Preview Error:', e))
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
      myPdfPreviewer.current?.destroy()
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
        <FileUploader accept=".pdf" onUpload={onUpload} disabled={loading} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '0 0 10px 0' }}>
            <Upload
              accept=".pdf"
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
            <div style={{ height: '100%' }} ref={pdfRef}></div>
          </div>
        </div>
      )}
    </Flex>
  )
}

export default PdfPreviewer
