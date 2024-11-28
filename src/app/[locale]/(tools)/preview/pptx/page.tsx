'use client'
import { useEffect, useRef, useState } from 'react'
import jsPreviewPPtx, { init } from 'pptx-preview'
import { Button, Flex, Spin, Upload } from 'antd'
import { RcFile } from 'antd/es/upload'

const DocxPerview = () => {
  const myPPtxPreviewer = useRef<ReturnType<typeof jsPreviewPPtx.init> | null>(null)
  const pptxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pptxRef.current) {
      //初始化时指明要挂载的父元素Dom节点
      myPPtxPreviewer.current = init(pptxRef.current, {
        width: '100%' as unknown as number,
        height: 700,
      })
    }
    return () => {
      myPPtxPreviewer.current?.dom.querySelectorAll('.pptx-preview-wrapper').forEach((e) => e.remove())
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const beforeUpload = (file: RcFile) => {
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
    <>
      <Flex gap="middle" vertical style={{ height: '100%', overflow: 'hidden', marginRight: '-20px' }}>
        <Flex>
          <Upload action="/" maxCount={1} showUploadList={false} accept=".pptx" beforeUpload={beforeUpload}>
            <Button>Click to Upload</Button>
          </Upload>
        </Flex>
        <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
          <Spin spinning={loading}></Spin>
          <div style={{ height: '100%' }} ref={pptxRef}></div>
        </div>
      </Flex>
    </>
  )
}

export default DocxPerview
