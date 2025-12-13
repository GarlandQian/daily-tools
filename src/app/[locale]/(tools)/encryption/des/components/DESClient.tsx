'use client'
import { CopyOutlined } from '@ant-design/icons'
import { Button, Form, Input, message,Radio, Select } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useHistory } from '@/hooks/useHistory'
import { type AesCryptoOptions,desCrypto, desEncodings, desFormats, desModes, desPaddings } from '@/util'

interface EncryptionType extends AesCryptoOptions {
  str: string
  secret: string
  isEncrypt: boolean
}

const DESClient = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm<EncryptionType>()
  const [result, setResult] = useState<string>()
  const { addHistory, lookupHistory } = useHistory('des')
  const [isEncrypt, setIsEncrypt] = useState(true)

  const onFinish = async (values: EncryptionType) => {
    if (values.isEncrypt) {
      const res = desCrypto(values.str, values.secret, values, true)
      setResult(res)
      addHistory({
        content: values.str,
        result: res,
        options: {
          isEncrypt: true,
          secret: values.secret,
          mode: values.mode,
          padding: values.padding,
          format: values.format,
          encoding: values.encoding,
          iv: values.iv,
        },
        status: 'SUCCESS',
      })
    } else {
      try {
        const res = desCrypto(values.str, values.secret, values, false)
        if (!res) {
          throw new Error('Decryption failed (empty result)')
        }
        setResult(res)
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        // If decryption fails, try to look up in history
        const historyRecord = await lookupHistory(values.str)
        if (historyRecord) {
          setResult(historyRecord.content)
          message.success(t('app.encryption.des.history_found'))
          return
        }

        message.warning(t('app.encryption.des.decrypt_failed'))
        setResult(t('app.encryption.des.decrypt_failed'))
        addHistory({
          content: values.str,
          result: 'Decryption Failed',
          options: {
            isEncrypt: false,
            secret: values.secret,
            mode: values.mode,
            padding: values.padding,
            format: values.format,
            encoding: values.encoding,
            iv: values.iv,
          },
          status: 'FAILED',
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
        <Form.Item label={t('app.encryption.des.mode')} name="isEncrypt">
          <Radio.Group>
            <Radio value={true}>{t('app.encryption.des.encrypt')}</Radio>
            <Radio value={false}>{t('app.encryption.des.decrypt')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('app.encryption.des.content')}
          name="str"
          rules={[{ required: true, message: t('app.encryption.des.content_required') }]}
        >
          <Input.TextArea rows={4} allowClear />
        </Form.Item>

        <Form.Item
          label={t('app.encryption.des.password')}
          name="secret"
          rules={[{ required: true, message: t('app.encryption.des.password_required') }]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item label={t('app.encryption.des.mode_select')} name="mode">
          <Select options={desModes} />
        </Form.Item>

        <Form.Item label={t('app.encryption.des.padding_select')} name="padding">
          <Select options={desPaddings} />
        </Form.Item>

        <Form.Item label={t('app.encryption.des.format_select')} name="format">
          <Select options={desFormats} />
        </Form.Item>

        <Form.Item label={t('app.encryption.des.encoding_select')} name="encoding">
          <Select options={desEncodings} />
        </Form.Item>

        <Form.Item label={t('app.encryption.des.iv')} name="iv">
          <Input />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 4, span: 16 }}>
          <Button type="primary" htmlType="submit">
            {isEncrypt ? t('app.encryption.des.encrypt') : t('app.encryption.des.decrypt')}
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

export default DESClient
