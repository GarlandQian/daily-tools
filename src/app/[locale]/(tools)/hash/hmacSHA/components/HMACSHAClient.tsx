'use client'
import { Button, Form, Input, Radio, Typography } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'
import { commonPasswords } from '@/const/common-passwords'

interface HMACSHAParams {
  message?: string
  key: string
  mode: 'HmacSHA1' | 'HmacSHA224' | 'HmacSHA256' | 'HmacSHA3' | 'HmacSHA384' | 'HmacSHA512'
  action: 'encrypt' | 'verify'
  targetHash?: string
}

export default function HMACSHAClient() {
  const { t } = useTranslation()

  const [form] = Form.useForm<HMACSHAParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [action, setAction] = useState<'encrypt' | 'verify'>('encrypt')

  const changeMode = () => {
    setResult(null)
  }

  const calculateHmac = (mode: string, msg: string, key: string): string => {
    switch (mode) {
      case 'HmacSHA1':
        return CryptoJS.HmacSHA1(msg, key).toString()
      case 'HmacSHA224':
        return CryptoJS.HmacSHA224(msg, key).toString()
      case 'HmacSHA256':
        return CryptoJS.HmacSHA256(msg, key).toString()
      case 'HmacSHA3':
        return CryptoJS.HmacSHA3(msg, key).toString()
      case 'HmacSHA384':
        return CryptoJS.HmacSHA384(msg, key).toString()
      case 'HmacSHA512':
        return CryptoJS.HmacSHA512(msg, key).toString()
      default:
        return ''
    }
  }

  const onFinish = (values: HMACSHAParams) => {
    if (values.action === 'encrypt' && values.message) {
      const hash = calculateHmac(values.mode, values.message, values.key)
      setResult({ text: hash })
    } else if (values.action === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) => calculateHmac(values.mode, pwd, values.key).toLowerCase() === target
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
        initialValues={{ mode: 'HmacSHA1', action: 'encrypt' }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={(changedValues) => {
          if (changedValues.action) {
            setAction(changedValues.action)
          }
        }}
      >
        <Form.Item label={t('app.hash.mode')} name="action">
          <Radio.Group>
            <Radio value="encrypt">{t('app.hash.generate')}</Radio>
            <Radio value="verify">{t('app.hash.verify')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="mode"
          label={t('app.hash.alg')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', { msg: t('app.hash.alg') })
            }
          ]}
        >
          <Radio.Group onChange={changeMode}>
            <Radio.Button value="HmacSHA1">HmacSHA1</Radio.Button>
            <Radio.Button value="HmacSHA224">HmacSHA224</Radio.Button>
            <Radio.Button value="HmacSHA256">HmacSHA256</Radio.Button>
            <Radio.Button value="HmacSHA3">HmacSHA3</Radio.Button>
            <Radio.Button value="HmacSHA384">HmacSHA384</Radio.Button>
            <Radio.Button value="HmacSHA512">HmacSHA512</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {action === 'encrypt' && (
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
          name="key"
          label={t('app.hash.key')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', { msg: t('app.hash.key') })
            }
          ]}
        >
          <Input />
        </Form.Item>

        {action === 'verify' && (
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
            {action === 'encrypt' ? t('public.generate') : t('public.verify')}
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
