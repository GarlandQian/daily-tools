'use client'
import { Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'

interface HMACSHAParams {
  message: string
  key: string
  mode: 'HmacSHA1' | 'HmacSHA224' | 'HmacSHA256' | 'HmacSHA3' | 'HmacSHA384' | 'HmacSHA512'
}

export default function HmacSHA() {
  const { t } = useTranslation()

  const [form] = Form.useForm<HMACSHAParams>()
  const [result, setReult] = useState('')

  const changeMode = () => {
    setReult('')
  }

  const onFinish = (values: HMACSHAParams) => {
    let value = ''
    const { message, key } = values
    switch (values.mode) {
      case 'HmacSHA1':
        value = CryptoJS.HmacSHA1(message, key).toString()
      case 'HmacSHA224':
        value = CryptoJS.HmacSHA224(message, key).toString()
      case 'HmacSHA256':
        value = CryptoJS.HmacSHA256(message, key).toString()
      case 'HmacSHA3':
        value = CryptoJS.HmacSHA3(message, key).toString()
      case 'HmacSHA384':
        value = CryptoJS.HmacSHA384(message, key).toString()
      case 'HmacSHA512':
        value = CryptoJS.HmacSHA512(message, key).toString()
    }
    setReult(value)
  }
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        initialValues={{ mode: 'HmacSHA1' }}
        labelCol={{ span: 2 }}
        wrapperCol={{ span: 16 }}
        onFinish={onFinish}
      >
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
          <Input.TextArea />
        </Form.Item>
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
        <Form.Item
          name="mode"
          label={t('app.hash.mode')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', { msg: t('app.hash.mode') })
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
