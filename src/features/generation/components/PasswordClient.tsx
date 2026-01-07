'use client'

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Form,
  InputNumber,
  Row,
  Slider,
  Typography
} from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PasswordForm {
  length: number
  count: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
}

const generatePassword = (length: number, charset: string): string => {
  let password = ''
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length]
  }
  return password
}

const PasswordClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [form] = Form.useForm<PasswordForm>()
  const [passwords, setPasswords] = useState<string[]>([])

  const handleGenerate = useCallback(
    (values: PasswordForm) => {
      const { length, count, uppercase, lowercase, numbers, symbols } = values

      let charset = ''
      if (uppercase) charset += CHAR_SETS.uppercase
      if (lowercase) charset += CHAR_SETS.lowercase
      if (numbers) charset += CHAR_SETS.numbers
      if (symbols) charset += CHAR_SETS.symbols

      if (!charset) {
        message.warning(t('app.generation.password.no_charset'))
        return
      }

      const newPasswords: string[] = []
      for (let i = 0; i < count; i++) {
        newPasswords.push(generatePassword(length, charset))
      }
      setPasswords(newPasswords)
      message.success(t('public.success'))
    },
    [message, t]
  )

  const handleCopyAll = useCallback(() => {
    if (!passwords.length) return
    navigator.clipboard.writeText(passwords.join('\n'))
    message.success(t('app.social.retires.copy_success'))
  }, [passwords, message, t])

  const handleCopySingle = useCallback(
    (pwd: string) => {
      navigator.clipboard.writeText(pwd)
      message.success(t('app.social.retires.copy_success'))
    },
    [message, t]
  )

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.generation.password')}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            length: 16,
            count: 5,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true
          }}
          onFinish={handleGenerate}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label={t('app.generation.password.length')} name="length">
                <Slider min={8} max={128} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label={t('app.generation.password.count')} name="count">
                <InputNumber style={{ width: '100%' }} min={1} max={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('app.generation.password.charset')}>
                <Flex gap={16} wrap>
                  <Form.Item name="uppercase" valuePropName="checked" noStyle>
                    <Checkbox>{t('app.generation.password.uppercase')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="lowercase" valuePropName="checked" noStyle>
                    <Checkbox>{t('app.generation.password.lowercase')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="numbers" valuePropName="checked" noStyle>
                    <Checkbox>{t('app.generation.password.numbers')}</Checkbox>
                  </Form.Item>
                  <Form.Item name="symbols" valuePropName="checked" noStyle>
                    <Checkbox>{t('app.generation.password.symbols')}</Checkbox>
                  </Form.Item>
                </Flex>
              </Form.Item>
            </Col>
          </Row>
          <Flex gap={10}>
            <Button type="primary" htmlType="submit" icon={<ReloadOutlined />}>
              {t('public.generate')}
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopyAll} disabled={!passwords.length}>
              {t('app.generation.uuid.copy')}
            </Button>
          </Flex>
        </Form>
      </Card>

      <Card
        title={t('app.generation.password.result')}
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'auto' } }}
      >
        <Flex vertical gap={8}>
          {passwords.map((pwd, index) => (
            <Flex key={index} align="center" gap={12}>
              <Typography.Text
                code
                copyable={false}
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}
              >
                {pwd}
              </Typography.Text>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopySingle(pwd)}
              />
            </Flex>
          ))}
        </Flex>
      </Card>
    </Flex>
  )
}

export default PasswordClient
