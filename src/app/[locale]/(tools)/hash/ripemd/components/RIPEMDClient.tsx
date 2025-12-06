'use client'
import { Button, Form, Input, Radio, Typography } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'
import { commonPasswords } from '@/const/common-passwords'

interface RIPEMDParams {
  message?: string
  mode: 'encrypt' | 'verify'
  targetHash?: string
}

export default function RIPEMDClient() {
  const { t } = useTranslation()

  const [form] = Form.useForm<RIPEMDParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [mode, setMode] = useState<'encrypt' | 'verify'>('encrypt')

  const onFinish = (values: RIPEMDParams) => {
    if (values.mode === 'encrypt' && values.message) {
      const hash = CryptoJS.RIPEMD160(values.message).toString()
      setResult({ text: hash })
    } else if (values.mode === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) => CryptoJS.RIPEMD160(pwd).toString().toLowerCase() === target
      )

      if (found) {
        setResult({ text: t('app.hash.verify.success') + found, success: true })
      } else {
        setResult({ text: t('app.hash.verify.fail'), success: false })
      }
    }
  }

  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        initialValues={{ mode: 'encrypt' }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={(changedValues) => {
          if (changedValues.mode) setMode(changedValues.mode)
        }}
      >
        <Form.Item label={t('app.hash.mode')} name="mode">
          <Radio.Group>
            <Radio value="encrypt">{t('app.hash.generate')}</Radio>
            <Radio value="verify">{t('app.hash.verify')}</Radio>
          </Radio.Group>
        </Form.Item>

        {mode === 'encrypt' && (
          <Form.Item
            name="message"
            label={t('app.hash.message')}
            rules={[
              {
                required: true,
                message: t('rules.msg.required', { msg: t('app.hash.message') })
              }
            ]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        )}

        {mode === 'verify' && (
          <Form.Item
            name="targetHash"
            label={t('app.hash.target')}
            rules={[
              {
                required: true,
                message: t('rules.msg.required', { msg: t('app.hash.target') })
              }
            ]}
          >
            <Input />
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit">
            {mode === 'encrypt' ? t('public.generate') : t('public.verify')}
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
                {result.success !== undefined ? (
                  <Typography.Text type={result.success ? 'success' : 'danger'}>
                    {result.text}
                  </Typography.Text>
                ) : (
                  <EllipsisMiddle suffixCount={12}>{result.text}</EllipsisMiddle>
                )}
              </Form.Item>
            </motion.div>
          )}
        </AnimatePresence>
      </Form>
    </>
  )
}
