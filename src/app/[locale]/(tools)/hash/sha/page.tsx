'use client'
import EllipsisMiddle from '@/components/EllipsisMiddle'
import { Button, Form, Input, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SHAParams {
  message: string
  mode: 'SHA1' | 'SHA224' | 'SHA256' | 'SHA3' | 'SHA384' | 'SHA512'
}

export default function HmacMD5() {
  const { t } = useTranslation()

  const [form] = Form.useForm<SHAParams>()
  const [result, setReult] = useState('')

  const changeMode = () => {
    setReult('')
  }

  const onFinish = (values: SHAParams) => {
    let value = ''
    const message = values.message
    switch (values.mode) {
      case 'SHA1':
        value = CryptoJS.SHA1(message).toString()
      case 'SHA224':
        value = CryptoJS.SHA224(message).toString()
      case 'SHA256':
        value = CryptoJS.SHA256(message).toString()
      case 'SHA3':
        value = CryptoJS.SHA3(message).toString()
      case 'SHA384':
        value = CryptoJS.SHA384(message).toString()
      case 'SHA512':
        value = CryptoJS.SHA512(message).toString()
    }
    setReult(value)
  }
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        initialValues={{ mode: 'SHA1' }}
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
          name="mode"
          label={t('app.hash.mode')}
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.hash.mode') }) }]}
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
