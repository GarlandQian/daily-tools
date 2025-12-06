'use client'
import { Button, Form, Input, InputNumber, Radio, Typography } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'
import { commonPasswords } from '@/const/common-passwords'

interface PBKDFParams {
  message?: string
  keySize: 128 | 256 | 512
  salt: string
  iterations: number
  mode: 'encrypt' | 'verify'
  targetHash?: string
}

export default function PBKDFClient() {
  const { t } = useTranslation()

  const [form] = Form.useForm<PBKDFParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [mode, setMode] = useState<'encrypt' | 'verify'>('encrypt')

  const onFinish = (values: PBKDFParams) => {
    const { salt, keySize, iterations } = values

    if (values.mode === 'encrypt' && values.message) {
      const hash = CryptoJS.PBKDF2(values.message, salt, { keySize, iterations }).toString()
      setResult({ text: hash })
    } else if (values.mode === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) =>
          CryptoJS.PBKDF2(pwd, salt, { keySize, iterations }).toString().toLowerCase() === target
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
        initialValues={{ mode: 'encrypt', keySize: 128 }}
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

        <Form.Item
          name="salt"
          label={t('app.hash.pbkdf.salt')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', {
                msg: t('app.hash.pbkdf.salt')
              })
            }
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="keySize"
          label={t('app.hash.pbkdf.keySize')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', {
                msg: t('app.hash.pbkdf.keySize')
              })
            }
          ]}
        >
          <Radio.Group>
            <Radio value={128}>128 byte</Radio>
            <Radio value={256}>256 byte</Radio>
            <Radio value={512}>512 byte</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="iterations"
          label={t('app.hash.pbkdf.iterations')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', {
                msg: t('app.hash.pbkdf.iterations')
              })
            }
          ]}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>

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
