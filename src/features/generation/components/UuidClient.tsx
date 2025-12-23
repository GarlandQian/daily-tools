'use client'

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select
} from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v1, v3, v4, v5 } from 'uuid'

interface UUIDForm {
  version: 'v1' | 'v3' | 'v4' | 'v5'
  quantity: number
  namespace?: string
  name?: string
}

const UuidClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [form] = Form.useForm<UUIDForm>()
  const [result, setResult] = useState<string>('')
  const [version, setVersion] = useState<'v1' | 'v3' | 'v4' | 'v5'>('v4')

  const generateUUID = async () => {
    try {
      let values: UUIDForm
      try {
        values = await form.validateFields()
      } catch {
        // If validation fails (e.g. on initial load with conditional fields), try getting values
        // This handles the case where fields might not be registered yet but we have defaults
        values = form.getFieldsValue() as UUIDForm
        if (!values.version) {
           // If mostly empty, fallback to defaults or return
           return
        }
      }

      const { quantity, namespace, name } = values
      const uuids: string[] = []

      for (let i = 0; i < (quantity || 5); i++) {
        let uuid = ''
        switch (values.version) {
          case 'v1':
            uuid = v1()
            break
          case 'v3':
            if (namespace && name) {
              uuid = v3(name, namespace)
            }
            break
          case 'v4':
            uuid = v4()
            break
          case 'v5':
            if (namespace && name) {
              uuid = v5(name, namespace)
            }
            break
        }
        if (uuid) {
          uuids.push(uuid)
        }
      }

      const res = uuids.join('\n')
      setResult(res)

      message.success(t('public.success'))
    } catch (error) {
      console.error(error)
      message.error(t('public.generate_failed'))
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    message.success(t('app.social.retires.copy_success'))
  }

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.generation.uuid')}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ version: 'v4', quantity: 5, namespace: v4() }}
          onValuesChange={(changedValues) => {
            if (changedValues.version) {
              setVersion(changedValues.version)
            }
          }}
          onFinish={generateUUID}
        >
          <Row gutter={16}>
            <Col span={6} xs={24} sm={12} md={6}>
              <Form.Item
                label={t('app.generation.uuid.version')}
                name="version"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: t('app.generation.uuid.v1'), value: 'v1' },
                    { label: t('app.generation.uuid.v3'), value: 'v3' },
                    { label: t('app.generation.uuid.v4'), value: 'v4' },
                    { label: t('app.generation.uuid.v5'), value: 'v5' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6} xs={24} sm={12} md={6}>
              <Form.Item
                label={t('app.generation.uuid.quantity')}
                name="quantity"
                rules={[{ required: true, type: 'number', min: 1, max: 100 }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={1000} />
              </Form.Item>
            </Col>
            {(version === 'v3' || version === 'v5') && (
              <>
                <Col span={6} xs={24} sm={12} md={6}>
                  <Form.Item
                    label={t('app.generation.uuid.namespace')}
                    name="namespace"
                    rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.generation.uuid.namespace') }) }]}
                  >
                    <Input placeholder={t('app.generation.uuid.ns_placeholder')} />
                  </Form.Item>
                </Col>
                <Col span={6} xs={24} sm={12} md={6}>
                  <Form.Item
                    label={t('app.generation.uuid.name')}
                    name="name"
                    rules={[{ required: true, message: t('rules.msg.required', { msg: t('app.generation.uuid.name') }) }]}
                  >
                    <Input placeholder={t('app.generation.uuid.name_placeholder')} />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col span={24}>
              <Flex gap={10}>
                <Button type="primary" htmlType="submit" icon={<ReloadOutlined />}>
                  {t('public.generate')}
                </Button>
                <Button icon={<CopyOutlined />} onClick={handleCopy}>
                  {t('app.generation.uuid.copy')}
                </Button>
              </Flex>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title={t('app.generation.uuid.result')} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, overflow: 'hidden' } }}>
        <Input.TextArea
          value={result}
          style={{ height: '100%', resize: 'none' }}
          readOnly
        />
      </Card>
    </Flex>
  )
}

export default UuidClient
