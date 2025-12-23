'use client'
import { CopyOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Radio, Select } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type AesCryptoOptions,
  aesEncodings,
  aesFormats,
  aesModes,
  aesPaddings,
  TripleDesCrypto} from '@/utils'

interface EncryptionType extends AesCryptoOptions {
  str: string
  secret: string
  isEncrypt: boolean
}

const TripleDESClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [form] = Form.useForm<EncryptionType>()
  const [result, setResult] = useState<string>()
  const [isEncrypt, setIsEncrypt] = useState(true)

  const onFinish = async (values: EncryptionType) => {
    if (values.isEncrypt) {
      try {
        const res = TripleDesCrypto(values.str, values.secret, values, true)
        setResult(res)
      } catch (error) {
        if (error instanceof Error) {
          message.error(t(error.message))
        } else {
          message.error(t('app.encryption.aes.encrypt_failed'))
        }
      }
    } else {
      try {
        const res = TripleDesCrypto(values.str, values.secret, values, false)
        if (!res) {
          throw new Error(t('app.encryption.aes.decrypt_failed_empty'))
        }
        setResult(res)
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        message.warning(t('app.encryption.aes.decrypt_failed'))
        setResult(t('app.encryption.aes.decrypt_failed'))
      }
    }
  }

  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        initialValues={{
          mode: 'ECB',
          padding: 'Pkcs7',
          format: 'Hex',
          encoding: 'Utf8',
          isEncrypt: true,
        }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={(changedValues) => {
          if (changedValues.isEncrypt !== undefined) {
            setIsEncrypt(changedValues.isEncrypt)
            setResult(undefined)
          }
        }}
      >
        <Form.Item label={t('app.encryption.aes.action')} name="isEncrypt">
          <Radio.Group>
            <Radio value={true}>{t('app.encryption.aes.encrypt')}</Radio>
            <Radio value={false}>{t('app.encryption.aes.decrypt')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('app.encryption.aes.content')}
          name="str"
          rules={[{ required: true, message: t('app.encryption.aes.content_required') }]}
        >
          <Input.TextArea rows={4} allowClear />
        </Form.Item>

        <Form.Item
          label={t('app.encryption.aes.password')}
          name="secret"
          rules={[{ required: true, message: t('app.encryption.aes.password_required') }]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item label={t('app.encryption.aes.mode')} name="mode">
          <Select options={aesModes} />
        </Form.Item>

        <Form.Item label={t('app.encryption.aes.padding')} name="padding">
          <Select options={aesPaddings} />
        </Form.Item>

        <Form.Item label={t('app.encryption.aes.format')} name="format">
          <Select options={aesFormats} />
        </Form.Item>

        <Form.Item label={t('app.encryption.aes.encoding')} name="encoding">
          <Select options={aesEncodings} />
        </Form.Item>

        <Form.Item label={t('app.encryption.aes.iv')} name="iv">
          <Input />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 4, span: 16 }}>
          <Button type="primary" htmlType="submit">
            {isEncrypt ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
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
                <div className="flex items-start gap-2">
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 10 }} value={result} readOnly />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(result)
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

export default TripleDESClient
