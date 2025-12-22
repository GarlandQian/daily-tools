'use client'
import { Flex, Spin } from 'antd'
import { RcFile } from 'antd/es/upload'
import type jsPreviewPPtx from 'pptx-preview'
import { useEffect, useRef, useState } from 'react'

import FileUploader from '../../components/FileUploader'

const PptxPreviewer = () => {
  const myPPtxPreviewer = useRef<ReturnType<typeof jsPreviewPPtx.init> | null>(null)
  const pptxRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    const init = async () => {
      if (pptxRef.current && !isInitialized.current) {
        const { init } = await import('pptx-preview')
        //初始化时指明要挂载的父元素Dom节点
        myPPtxPreviewer.current = init(pptxRef.current, {
          width: '100%' as unknown as number,
          height: 700
        })
        isInitialized.current = true
      }
      if (isInitialized.current && previewBuffer) {
        myPPtxPreviewer.current?.preview(previewBuffer).finally(() => {
          setLoading(false)
        })
      }
    }
    if (hasFile) {
      init()
    }
  }, [hasFile, previewBuffer])

  useEffect(() => {
    return () => {
      myPPtxPreviewer.current?.dom
        .querySelectorAll('.pptx-preview-wrapper')
        .forEach(e => e.remove())
      isInitialized.current = false
    }
  }, [])

  const onUpload = (file: RcFile) => {
    setLoading(true)
    setHasFile(true)
    const reader = new FileReader()
    reader.onload = function (event) {
      const arrayBuffer = event.target?.result as ArrayBuffer
      setPreviewBuffer(arrayBuffer)
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden' }}>
      <FileUploader accept=".pptx" onUpload={onUpload} disabled={loading} />
      {hasFile && (
        <div style={{ overflow: 'hidden', flex: 1, position: 'relative' }}>
          <Spin
            spinning={loading}
            style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
          />
          <div style={{ height: '100%' }} ref={pptxRef}></div>
        </div>
      )}
    </Flex>
  )
}

export default PptxPreviewer
