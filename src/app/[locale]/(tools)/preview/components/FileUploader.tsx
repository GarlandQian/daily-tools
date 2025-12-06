'use client'
import { InboxOutlined } from '@ant-design/icons'
import { Upload, UploadProps } from 'antd'
import { RcFile } from 'antd/es/upload'

const { Dragger } = Upload

interface FileUploaderProps {
  accept: string
  onUpload: (file: RcFile) => void
  disabled?: boolean
  tip?: string
}

const FileUploader = ({ accept, onUpload, disabled = false, tip }: FileUploaderProps) => {
  const props: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    accept,
    disabled,
    customRequest: ({ file, onSuccess }) => {
      setTimeout(() => {
        onSuccess?.('ok')
        onUpload(file as RcFile)
      }, 0)
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files)
    }
  }

  return (
    <Dragger {...props} style={{ padding: '20px' }}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Click or drag file to this area to upload</p>
      <p className="ant-upload-hint">{tip || `Support for ${accept} files`}</p>
    </Dragger>
  )
}

export default FileUploader
