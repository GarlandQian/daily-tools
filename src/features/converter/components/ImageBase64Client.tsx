'use client'

import { CopyOutlined, InboxOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Switch,
  theme as antTheme,
  Typography,
  Upload
} from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ImageBase64Client = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { token: theme } = antTheme.useToken()

  const [base64, setBase64] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [includeDataUri, setIncludeDataUri] = useState(true)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string } | null>(
    null
  )

  const handleFileChange = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = e => {
        const result = e.target?.result as string
        setBase64(result)
        setPreviewUrl(result)
        setFileInfo({
          name: file.name,
          size: file.size,
          type: file.type
        })
      }
      reader.onerror = () => {
        message.error(t('public.generate_failed'))
      }
      reader.readAsDataURL(file)
      return false // Prevent default upload behavior
    },
    [message, t]
  )

  const handleCopy = useCallback(() => {
    if (!base64) return
    const textToCopy = includeDataUri ? base64 : base64.split(',')[1] || base64
    navigator.clipboard.writeText(textToCopy)
    message.success(t('app.social.retires.copy_success'))
  }, [base64, includeDataUri, message, t])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.converter.image')}>
        <Upload.Dragger
          accept="image/*"
          showUploadList={false}
          beforeUpload={handleFileChange}
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('app.converter.image.upload')}</p>
          <p className="ant-upload-hint">{t('app.converter.image.hint')}</p>
        </Upload.Dragger>

        {fileInfo && (
          <Flex gap={16} wrap style={{ marginTop: 16 }}>
            <Typography.Text>
              <strong>{t('app.converter.image.filename')}:</strong> {fileInfo.name}
            </Typography.Text>
            <Typography.Text>
              <strong>{t('app.converter.image.size')}:</strong> {formatSize(fileInfo.size)}
            </Typography.Text>
            <Typography.Text>
              <strong>{t('app.converter.image.type')}:</strong> {fileInfo.type}
            </Typography.Text>
          </Flex>
        )}
      </Card>

      <Row gutter={16} style={{ flex: 1 }}>
        <Col xs={24} md={8}>
          <Card title={t('app.converter.image.preview')} style={{ height: '100%' }}>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 300,
                  display: 'block',
                  margin: '0 auto',
                  borderRadius: 8
                }}
              />
            ) : (
              <Flex
                justify="center"
                align="center"
                style={{
                  height: 200,
                  background: theme.colorBgLayout,
                  borderRadius: 8,
                  color: theme.colorTextSecondary
                }}
              >
                {t('app.converter.image.no_image')}
              </Flex>
            )}
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card
            title="Base64"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{
              body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
            }}
            extra={
              <Flex gap={16} align="center">
                <Flex gap={8} align="center">
                  <Typography.Text type="secondary">Data URI</Typography.Text>
                  <Switch checked={includeDataUri} onChange={setIncludeDataUri} size="small" />
                </Flex>
                <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!base64}>
                  {t('app.generation.uuid.copy')}
                </Button>
              </Flex>
            }
          >
            <textarea
              value={includeDataUri ? base64 : base64.split(',')[1] || ''}
              readOnly
              style={{
                flex: 1,
                width: '100%',
                fontFamily: 'monospace',
                fontSize: 12,
                padding: 12,
                border: `1px solid ${theme.colorBorderSecondary}`,
                borderRadius: 8,
                background: theme.colorBgLayout,
                resize: 'none',
                color: theme.colorText
              }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default ImageBase64Client
