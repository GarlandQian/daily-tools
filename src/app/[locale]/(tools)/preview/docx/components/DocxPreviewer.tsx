'use client'
import type { JsDocxPreview } from '@js-preview/docx'
import { Flex, Spin } from 'antd'
import { RcFile } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'

import FileUploader from '../../components/FileUploader'

const DocxPreviewer = () => {
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
      <FileUploader accept=".docx" onUpload={onUpload} disabled={loading} />
      {hasFile && (
        <div style={{ overflow: 'auto', flex: 1, position: 'relative' }}>
          <Spin
            spinning={loading}
            style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
          />
          <div style={{ height: '100%' }} ref={docxRef}></div>
        </div>
      )}
    </Flex>
  )
}

export default DocxPreviewer
