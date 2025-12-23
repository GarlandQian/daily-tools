'use client'
import { CopyOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { commonPasswords } from '@/const/common-passwords'
import { useHistory } from '@/hooks/useHistory'

interface RIPEMDParams {
  message?: string
  mode: 'encrypt' | 'verify'
  targetHash?: string
}

export default function RIPEMDClient() {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [form] = Form.useForm<RIPEMDParams>()
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [mode, setMode] = useState<'encrypt' | 'verify'>('encrypt')
  const { addHistory, lookupHistory } = useHistory('ripemd')

  const onFinish = async (values: RIPEMDParams) => {
    if (values.mode === 'encrypt' && values.message) {
      const hash = CryptoJS.RIPEMD160(values.message).toString()
      setResult({ text: hash })
      addHistory({
        content: values.message,
        result: hash,
        options: { mode: 'encrypt' }
      })
    } else if (values.mode === 'verify' && values.targetHash) {
      const target = values.targetHash.toLowerCase()
      const found = commonPasswords.find(
        (pwd) => CryptoJS.RIPEMD160(pwd).toString().toLowerCase() === target
      )

      if (found) {
        setResult({ text: found, success: true })
        message.success(t('app.hash.verify.success'))
        addHistory({
          content: target,
          result: found,
          options: { mode: 'verify', success: true }
        })
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
          options: { mode: 'verify', success: false },
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
        initialValues={{ mode: 'encrypt' }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={(changedValues) => {
          if (changedValues.mode) {
            setMode(changedValues.mode)
            setResult(null)
          }
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
