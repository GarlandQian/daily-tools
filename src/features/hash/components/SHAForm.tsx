'use client'
import { CopyOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { commonPasswords } from '@/const/common-passwords'
import { useHistory } from '@/hooks/useHistory'

interface SHAParams {
  message?: string
  mode: 'SHA1' | 'SHA224' | 'SHA256' | 'SHA3' | 'SHA384' | 'SHA512'
  action: 'encrypt' | 'verify'
  targetHash?: string
}

export default function SHAForm() {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [form] = Form.useForm<SHAParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [action, setAction] = useState<'encrypt' | 'verify'>('encrypt')
  const { addHistory, lookupHistory } = useHistory('sha')

  const changeMode = () => {
    setResult(null)
  }

  const calculateHash = (mode: string, msg: string): string => {
    switch (mode) {
      case 'MD5':
        return CryptoJS.MD5(msg).toString()
      case 'SHA1':
        return CryptoJS.SHA1(msg).toString()
      case 'SHA224':
        return CryptoJS.SHA224(msg).toString()
      case 'SHA256':
        return CryptoJS.SHA256(msg).toString()
      case 'SHA3':
        return CryptoJS.SHA3(msg).toString()
      case 'SHA384':
        return CryptoJS.SHA384(msg).toString()
      case 'SHA512':
        return CryptoJS.SHA512(msg).toString()
      case 'RIPEMD160':
        return CryptoJS.RIPEMD160(msg).toString()
      default:
        return ''
    }
  }

  const onFinish = async (values: SHAParams) => {
    if (values.action === 'encrypt' && values.message) {
      const hash = calculateHash(values.mode, values.message)
      setResult({ text: hash })
      addHistory({
        content: values.message,
        result: hash,
        options: { mode: values.mode, action: 'encrypt' }
      })
      // Encrypt: Saved for Rainbow Table
    } else if (values.action === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) => calculateHash(values.mode, pwd).toLowerCase() === target
      )

      if (found) {
        setResult({ text: found, success: true })
        message.success(t('app.hash.verify.success'))
        // Verify Success: Do not save
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
          options: { mode: values.mode, action: 'verify', success: false },
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
        initialValues={{ mode: 'SHA1', action: 'encrypt' }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={(changedValues) => {
          if (changedValues.action) {
            setAction(changedValues.action)
            setResult(null)
          }
          if (changedValues.mode) {
            changeMode()
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
            <Radio.Button value="SHA1">SHA1</Radio.Button>
            <Radio.Button value="SHA224">SHA224</Radio.Button>
            <Radio.Button value="SHA256">SHA256</Radio.Button>
            <Radio.Button value="SHA3">SHA3</Radio.Button>
            <Radio.Button value="SHA384">SHA384</Radio.Button>
            <Radio.Button value="SHA512">SHA512</Radio.Button>
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
