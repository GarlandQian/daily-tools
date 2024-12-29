'use client'
import { Button, Form, Input, InputNumber, Radio } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import EllipsisMiddle from '@/components/EllipsisMiddle'

interface PBKDFParams {
  message: string
  keySize: 128 | 256 | 512
  salt: string
  iterations: number
}

export default function PBKDF() {
  const { t } = useTranslation()

  const [form] = Form.useForm<PBKDFParams>()
  const [result, setReult] = useState('')

  const onFinish = ({ message, salt, keySize, iterations }: PBKDFParams) => {
    setReult(CryptoJS.PBKDF2(message, salt, { keySize, iterations }).toString())
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
          <InputNumber min={0} precision={0}></InputNumber>
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
