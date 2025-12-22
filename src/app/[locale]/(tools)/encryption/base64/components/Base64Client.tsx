'use client'
import { CopyOutlined } from '@ant-design/icons'
import { Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'


interface Base64Params {
  text: string
  mode: 'encode' | 'decode'
}

export default function Base64Client() {
  const { t } = useTranslation()

  const [form] = Form.useForm<Base64Params>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const onFinish = (values: Base64Params) => {
    try {
      if (values.mode === 'encode') {
        const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(values.text))
        setResult({ text: encoded, success: true })
      } else {
        const decoded = CryptoJS.enc.Base64.parse(values.text).toString(CryptoJS.enc.Utf8)
        if (decoded) {
            setResult({ text: decoded, success: true })
        } else {
             // Fallback or empty result logic if needed
             setResult({ text: '', success: true })
        }
      }
    } catch {
       // crypto-js might throw or return empty string on invalid base64
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
                       // Optional: message.success(t('public.copy.success')) - need translation key or use english
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
