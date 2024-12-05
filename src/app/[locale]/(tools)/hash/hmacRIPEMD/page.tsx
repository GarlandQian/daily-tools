'use client'
import { Button, Form, Input } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'

interface HMACRIPEMDParams {
  message: string
  key: string
}

export default function HAMCRIPEMD() {
  const { t } = useTranslation()

  const [form] = Form.useForm<HMACRIPEMDParams>()
  const [result, setReult] = useState('')

  const onFinish = (values: HMACRIPEMDParams) => {
    setReult(CryptoJS.HmacRIPEMD160(values.message, values.key).toString())
  }
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        labelCol={{ span: 2 }}
        wrapperCol={{ span: 16 }}
        onFinish={onFinish}
      >
        <Form.Item
          name="message"
          label={t('app.hash.message')}
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.hash.message') }) }]}
        >
          <Input.TextArea />
        </Form.Item>
        <Form.Item
          name="key"
          label={t('app.hash.key')}
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.hash.key') }) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            {t('public.submit')}
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
                <EllipsisMiddle suffixCount={12}>{result}</EllipsisMiddle>
              </Form.Item>
            </motion.div>
          )}
        </AnimatePresence>
      </Form>
    </>
  )
}
