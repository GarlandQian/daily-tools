'use client'
import { Flex, Spin } from 'antd'
import { RcFile } from 'antd/es/upload'
import type jsPreviewPPtx from 'pptx-preview'
import { useEffect, useRef, useState } from 'react'

import FileUploader from '../../components/FileUploader'

const PptxPreviewer = () => {
  const myPPtxPreviewer = useRef<ReturnType<typeof jsPreviewPPtx.init> | null>(null)
  const pptxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      if (pptxRef.current) {
        const { init } = await import('pptx-preview')
        //初始化时指明要挂载的父元素Dom节点
        myPPtxPreviewer.current = init(pptxRef.current, {
          width: '100%' as unknown as number,
          height: 700
        })
      }
    }
    init()
    return () => {
      myPPtxPreviewer.current?.dom
        .querySelectorAll('.pptx-preview-wrapper')
        .forEach(e => e.remove())
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const onUpload = (file: RcFile) => {
    setLoading(true)
    const reader = new FileReader()
    reader.onload = function (event) {
      const arrayBuffer = event.target?.result as ArrayBuffer
      myPPtxPreviewer.current?.preview(arrayBuffer).finally(() => {
        setLoading(false)
      })
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden' }}>
      <FileUploader accept=".pptx" onUpload={onUpload} disabled={loading} />
      <div style={{ overflow: 'hidden', flex: 1, position: 'relative' }}>
        <Spin spinning={loading} style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />
        <div style={{ height: '100%' }} ref={pptxRef}></div>
      </div>
    </Flex>
  )
}

export default PptxPreviewer
