'use client'
import { CopyOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { commonPasswords } from '@/const/common-passwords'
import { useHistory } from '@/hooks/useHistory'

interface HMACSHAParams {
  message?: string
  key: string
  mode: 'HmacSHA1' | 'HmacSHA224' | 'HmacSHA256' | 'HmacSHA3' | 'HmacSHA384' | 'HmacSHA512'
  action: 'encrypt' | 'verify'
  targetHash?: string
}

export default function HMACSHAClient() {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [form] = Form.useForm<HMACSHAParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [action, setAction] = useState<'encrypt' | 'verify'>('encrypt')
  const { addHistory, lookupHistory } = useHistory('hmacsha')

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

  const onFinish = async (values: HMACSHAParams) => {
    if (values.action === 'encrypt' && values.message) {
      const hash = calculateHmac(values.mode, values.message, values.key)
      setResult({ text: hash })
      addHistory({
        content: values.message,
        result: hash,
        options: { mode: values.mode, action: 'encrypt', key: values.key }
      })
    } else if (values.action === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) => calculateHmac(values.mode, pwd, values.key).toLowerCase() === target
      )

      if (found) {
        setResult({ text: found, success: true })
        message.success(t('app.hash.verify.success'))
      } else {
        // Try to look up in history
        const historyRecord = await lookupHistory(target)
        if (historyRecord) {
          setResult({ text: historyRecord.content, success: true })
          message.success(t('app.hash.verify.success'))
          return
        }

        message.warning(t('app.hash.verify.fail'))
        setResult({ text: t('app.hash.verify.fail'), success: false })
        addHistory({
          content: target,
          result: 'Verify Failed',
          options: { mode: values.mode, action: 'verify', key: values.key, success: false },
          status: 'FAILED'
        })
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
            setResult(null)
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
    </>
  )
}
