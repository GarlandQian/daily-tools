'use client'
import { Button, Form, Input } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface HMACMD5Params {
  message: string
  key: string
}

export default function HAMCMD5() {
  const { t } = useTranslation()

  const [form] = Form.useForm<HMACMD5Params>()
  const [result, setReult] = useState('')

  const onFinish = (values: HMACMD5Params) => {
    setReult(CryptoJS.HmacMD5(values.message, values.key).toString())
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
              <Form.Item label={t('app.hash.result')}>{result}</Form.Item>
            </motion.div>
          )}
        </AnimatePresence>
      </Form>
    </>
  )
}
