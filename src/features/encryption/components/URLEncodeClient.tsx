'use client'
import { CopyOutlined } from '@ant-design/icons'
import { Button, Form, Input, Radio } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface URLEncodeParams {
  text: string
  mode: 'encode' | 'decode'
}

export default function URLEncodeClient() {
  const { t } = useTranslation()

  const [form] = Form.useForm<URLEncodeParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const onFinish = (values: URLEncodeParams) => {
    try {
      if (values.mode === 'encode') {
        const encoded = encodeURIComponent(values.text)
        setResult({ text: encoded, success: true })
      } else {
        const decoded = decodeURIComponent(values.text)
        setResult({ text: decoded, success: true })
      }
    } catch {
      setResult({ text: t('app.encryption.aes.decrypt_failed'), success: false })
    }
  }

  return (
    <Form
      labelAlign="left"
      layout="horizontal"
      form={form}
      initialValues={{ mode: 'encode' }}
      labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
      wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
      onFinish={onFinish}
      onValuesChange={(changedValues) => {
        if (changedValues.mode) setMode(changedValues.mode)
      }}
    >
      <Form.Item label={t('app.encryption.aes.action')} name="mode">
        <Radio.Group>
          <Radio value="encode">{t('app.encryption.aes.encrypt')}</Radio>
          <Radio value="decode">{t('app.encryption.aes.decrypt')}</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="text"
        label={t('app.encryption.aes.str')}
        rules={[
          {
            required: true,
            message: t('rules.msg.required', { msg: t('app.encryption.aes.str') })
          }
        ]}
      >
        <Input.TextArea rows={4} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
            {mode === 'encode' ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
        </Button>
      </Form.Item>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 1 }}
          >
            <Form.Item label={t('app.hash.result')}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 10 }} value={result.text} readOnly />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                       navigator.clipboard.writeText(result.text)
                    }}
                  />
                </div>
            </Form.Item>
          </motion.div>
        )}
      </AnimatePresence>
    </Form>
  )
}
