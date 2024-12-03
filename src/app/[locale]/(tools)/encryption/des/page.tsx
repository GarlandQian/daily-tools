'use client'
import EllipsisMiddle from '@/components/EllipsisMiddle'
import { desCrypto, type AesCryptoOptions } from '@/util'
import { Button, Form, Input, Radio, Select } from 'antd'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface EncryptionType extends AesCryptoOptions {
  str: string
  secret: string
  isEncrypt: boolean
}

const AESPage = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm<EncryptionType>()
  const [result, setResult] = useState<string>()
  const onFinish = (values: EncryptionType) => {
    setResult(desCrypto(values.str, values.secret, values, values.isEncrypt))
  }
  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        initialValues={{ isEncrypt: true }}
        labelCol={{ span: 2 }}
        wrapperCol={{ span: 16 }}
        onFinish={onFinish}
      >
        <Form.Item label={t('app.encryption.aes.encrypt')} name="isEncrypt">
          <Radio.Group
            options={[
              { label: t('app.encryption.aes.encrypt.yes'), value: true },
              { label: t('app.encryption.aes.encrypt.no'), value: false },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.str')}
          name="str"
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.str') }) }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.secret')}
          name="secret"
          rules={[
            { required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.secret') }) },
            {
              validator: (_rule, value) => {
                if (value && ![16, 24, 32].includes(CryptoJS.enc.Utf8.parse(value).sigBytes)) {
                  return Promise.reject(t('app.encryption.aes.iv.length'))
                } else {
                  return Promise.resolve()
                }
              },
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.iv')}
          name="iv"
          rules={[
            { required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.iv') }) },
            {
              validator: (_rule, value) => {
                if (value && CryptoJS.enc.Utf8.parse(value).sigBytes !== 16) {
                  return Promise.reject(t('app.encryption.aes.iv.length'))
                } else {
                  return Promise.resolve()
                }
              },
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.mode')}
          name="mode"
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.mode') }) }]}
        >
          <Select
            options={[
              { label: 'CBC', value: 'CBC' },
              { label: 'CFB', value: 'CFB' },
              { label: 'CTR', value: 'CTR' },
              { label: 'CTRGladman', value: 'CTRGladman' },
              { label: 'ECB', value: 'ECB' },
              { label: 'OFB', value: 'OFB' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.padding')}
          name="padding"
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.padding') }) }]}
        >
          <Select
            options={[
              { label: 'Pkcs7', value: 'Pkcs7' },
              { label: 'AnsiX923', value: 'AnsiX923' },
              { label: 'Iso10126', value: 'Iso10126' },
              { label: 'Iso97971', value: 'Iso97971' },
              { label: 'ZeroPadding', value: 'ZeroPadding' },
              { label: 'NoPadding', value: 'NoPadding' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.format')}
          name="format"
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.format') }) }]}
        >
          <Select
            options={[
              { label: 'OpenSSL', value: 'OpenSSL' },
              { label: 'Hex', value: 'Hex' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('app.encryption.aes.encoding')}
          name="encoding"
          rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.encryption.aes.encoding') }) }]}
        >
          <Select
            options={[
              { label: 'Hex', value: 'Hex' },
              { label: 'Latin1', value: 'Latin1' },
              { label: 'Utf8', value: 'Utf8' },
              { label: 'Utf16', value: 'Utf16' },
              { label: 'Utf16BE', value: 'Utf16BE' },
              { label: 'Utf16LE', value: 'Utf16LE' },
              { label: 'Base64', value: 'Base64' },
              { label: 'Base64url', value: 'Base64url' },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            {t('public.submit')}
          </Button>
        </Form.Item>
      </Form>
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
    </>
  )
}

export default AESPage
