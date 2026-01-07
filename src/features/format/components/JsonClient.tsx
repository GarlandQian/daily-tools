'use client'

import {
  ClearOutlined,
  CompressOutlined,
  CopyOutlined,
  FormatPainterOutlined
} from '@ant-design/icons'
import { App, Button, Card, Col, Flex, Input, Row, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

const JsonClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parseJson = useCallback((text: string): unknown | null => {
    try {
      setError(null)
      return JSON.parse(text)
    } catch (e) {
      const err = e as SyntaxError
      setError(err.message)
      return null
    }
  }, [])

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      message.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setOutput(JSON.stringify(parsed, null, 2))
      message.success(t('public.success'))
    }
  }, [input, parseJson, message, t])

  const handleMinify = useCallback(() => {
    if (!input.trim()) {
      message.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setOutput(JSON.stringify(parsed))
      message.success(t('public.success'))
    }
  }, [input, parseJson, message, t])

  const handleValidate = useCallback(() => {
    if (!input.trim()) {
      message.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setError(null)
      message.success(t('app.format.json.valid'))
    }
  }, [input, parseJson, message, t])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output)
    message.success(t('app.social.retires.copy_success'))
  }, [output, message, t])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.format.json')}>
        <Flex gap={10} wrap>
          <Button type="primary" icon={<FormatPainterOutlined />} onClick={handleFormat}>
            {t('app.format.json.format')}
          </Button>
          <Button icon={<CompressOutlined />} onClick={handleMinify}>
            {t('app.format.json.minify')}
          </Button>
          <Button onClick={handleValidate}>{t('app.format.json.validate')}</Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!output}>
            {t('app.generation.uuid.copy')}
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            {t('app.format.json.clear')}
          </Button>
        </Flex>
      </Card>

      {error && (
        <Typography.Text type="danger" style={{ padding: '0 8px' }}>
          {t('app.format.json.error')}: {error}
        </Typography.Text>
      )}

      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        <Col xs={24} md={12} style={{ height: '100%', minHeight: 300 }}>
          <Card
            title={t('app.format.json.input')}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'hidden' } }}
          >
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('app.format.json.input_placeholder')}
              style={{ height: '100%', resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ height: '100%', minHeight: 300 }}>
          <Card
            title={t('app.format.json.output')}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'hidden' } }}
          >
            <Input.TextArea
              value={output}
              readOnly
              style={{ height: '100%', resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default JsonClient
