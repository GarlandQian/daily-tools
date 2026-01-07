'use client'

import { DownloadOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, ColorPicker, Flex, Form, Input, Row, Slider } from 'antd'
import { QRCodeCanvas } from 'qrcode.react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface QrcodeForm {
  content: string
  size: number
  fgColor: string
  bgColor: string
}

const QrcodeClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [form] = Form.useForm<QrcodeForm>()
  const qrRef = useRef<HTMLDivElement>(null)
  const [formValues, setFormValues] = useState<QrcodeForm>({
    content: 'https://github.com',
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff'
  })

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      message.error(t('public.generate_failed'))
      return
    }
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = 'qrcode.png'
    link.href = url
    link.click()
    message.success(t('public.success'))
  }, [message, t])

  const handleValuesChange = (_: Partial<QrcodeForm>, allValues: QrcodeForm) => {
    setFormValues({
      ...allValues,
      fgColor: typeof allValues.fgColor === 'string' ? allValues.fgColor : formValues.fgColor,
      bgColor: typeof allValues.bgColor === 'string' ? allValues.bgColor : formValues.bgColor
    })
  }

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.generation.qrcode')}>
        <Form
          form={form}
          layout="vertical"
          initialValues={formValues}
          onValuesChange={handleValuesChange}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('app.generation.qrcode.content')}
                name="content"
                rules={[
                  {
                    required: true,
                    message: t('rules.msg.required', {
                      msg: t('app.generation.qrcode.content')
                    })
                  }
                ]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder={t('app.generation.qrcode.content_placeholder')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label={t('app.generation.qrcode.size')} name="size">
                <Slider min={128} max={512} step={8} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Item label={t('app.generation.qrcode.fgColor')} name="fgColor">
                <ColorPicker
                  format="hex"
                  onChange={color => {
                    const hex = color.toHexString()
                    form.setFieldValue('fgColor', hex)
                    setFormValues(prev => ({ ...prev, fgColor: hex }))
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Item label={t('app.generation.qrcode.bgColor')} name="bgColor">
                <ColorPicker
                  format="hex"
                  onChange={color => {
                    const hex = color.toHexString()
                    form.setFieldValue('bgColor', hex)
                    setFormValues(prev => ({ ...prev, bgColor: hex }))
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={t('app.generation.qrcode.preview')}
        style={{ flex: 1 }}
        extra={
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            {t('app.generation.qrcode.download')}
          </Button>
        }
      >
        <Flex justify="center" align="center" style={{ padding: 24 }}>
          <div ref={qrRef}>
            <QRCodeCanvas
              value={formValues.content || ' '}
              size={formValues.size}
              fgColor={formValues.fgColor}
              bgColor={formValues.bgColor}
              level="H"
            />
          </div>
        </Flex>
      </Card>
    </Flex>
  )
}

export default QrcodeClient
