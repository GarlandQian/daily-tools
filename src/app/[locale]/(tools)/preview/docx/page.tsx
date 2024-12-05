'use client'
import '@js-preview/docx/lib/index.css'

import jsPreviewDocx, { JsDocxPreview } from '@js-preview/docx'
import { Button, Flex, Spin, Upload } from 'antd'
import { UploadChangeParam } from 'antd/es/upload'
import { useEffect, useRef, useState } from 'react'

const DocxPerview = () => {
  const myDocxPreviewer = useRef<JsDocxPreview | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (docxRef.current) {
      //初始化时指明要挂载的父元素Dom节点
      myDocxPreviewer.current = jsPreviewDocx.init(docxRef.current)
    }
    return () => {
      myDocxPreviewer.current?.destroy()
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const onChange = ({ file }: UploadChangeParam) => {
    if (file.status === 'done' && file.originFileObj) {
      // 文件上传成功后，获取文件对象并生成 URL
      const url = URL.createObjectURL(file.originFileObj)
      setLoading(true)
      myDocxPreviewer.current?.preview(url).finally(() => {
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
          <div style={{ height: '100%' }} ref={docxRef}></div>
        </div>
      </Flex>
    </>
  )
}

export default DocxPerview
