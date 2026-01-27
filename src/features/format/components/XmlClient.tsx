'use client'

import { CompressOutlined, FormatPainterOutlined } from '@ant-design/icons'
import { Button, Card, Col, Input, Row, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import xmlFormat from 'xml-formatter'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

const XmlClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFormat = useCallback(() => {
    if (!input.trim()) return
    try {
      const formatted = xmlFormat(input, {
        indentation: '  ',
        collapseContent: true,
        lineSeparator: '\n'
      })
      setOutput(formatted)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setOutput('')
    }
  }, [input])

  const handleMinify = useCallback(() => {
    if (!input.trim()) return
    try {
      const minified = xmlFormat.minify(input, {
        collapseContent: true
      })
      setOutput(minified)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setOutput('')
    }
  }, [input])

  return (
    <ToolLayout
      title="app.format.xml"
      showCopy
      copyDisabled={!output}
      onCopy={() => copy(output)}
      showClear
      onClear={() => {
        setInput('')
        setOutput('')
        setError(null)
      }}
      extra={
        <>
          <Button type="primary" icon={<FormatPainterOutlined />} onClick={handleFormat}>
            {t('app.format.json.format')}
          </Button>
          <Button icon={<CompressOutlined />} onClick={handleMinify}>
            {t('app.format.json.minify')}
          </Button>
        </>
      }
    >
      {error && (
        <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
          {t('app.format.json.error')}: {error}
        </Typography.Text>
      )}
      <Row gutter={16} style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title={t('app.format.json.input')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="<root><item>value</item></root>"
              style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title={t('app.format.json.output')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <Input.TextArea
              value={output}
              readOnly
              style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
      </Row>
    </ToolLayout>
  )
}

export default XmlClient
