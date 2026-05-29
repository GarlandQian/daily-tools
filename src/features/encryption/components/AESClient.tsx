'use client'
import { Copy } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

import {
  aesCrypto,
  type AesCryptoOptions,
  aesEncodings,
  aesFormats,
  aesModes,
  aesPaddings
} from '../utils'

interface EncryptionType extends AesCryptoOptions {
  str: string
  secret: string
  isEncrypt: boolean
}

const AESClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [result, setResult] = useState<string>()
  const [isEncrypt, setIsEncrypt] = useState(true)

  const [str, setStr] = useState('')
  const [secret, setSecret] = useState('')
  const [mode, setMode] = useState('ECB')
  const [padding, setPadding] = useState('Pkcs7')
  const [format, setFormat] = useState('Hex')
  const [encoding, setEncoding] = useState('Utf8')
  const [iv, setIv] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!str.trim()) {
      toast.warning(t('app.encryption.aes.content_required'))
      return
    }
    if (!secret.trim()) {
      toast.warning(t('app.encryption.aes.password_required'))
      return
    }

    const values: AesCryptoOptions = { mode, padding, format, encoding, iv }

    if (isEncrypt) {
      try {
        const res = aesCrypto(str, secret, values, true)
        setResult(res)
      } catch (error) {
        if (error instanceof Error) {
          toast.error(t(error.message))
        } else {
          toast.error(t('app.encryption.aes.encrypt_failed'))
        }
      }
    } else {
      try {
        const res = aesCrypto(str, secret, values, false)
        if (!res) {
          throw new Error(t('app.encryption.aes.decrypt_failed_empty'))
        }
        setResult(res)
      } catch {
        toast.warning(t('app.encryption.aes.decrypt_failed'))
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
          isEncrypt: true
        }}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
        onValuesChange={changedValues => {
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

export default AESClient
