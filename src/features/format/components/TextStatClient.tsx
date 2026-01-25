'use client'

import { Card, Col, Flex, Input, Row, Statistic } from 'antd'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

const TextStatClient = () => {
  useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')

  const stats = useMemo(() => {
    const text = input

    // Character count
    const chars = text.length

    // Character count (no spaces)
    const charsNoSpaces = text.replace(/\s/g, '').length

    // Word count (rough estimation)
    const words = text.trim() ? text.trim().split(/\s+/).length : 0

    // Line count
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0

    // Paragraph count (double newlines)
    const paragraphs = text.trim() ? text.trim().split(/(\r\n|\r|\n){2,}/).length : 0

    // Byte size (UTF-8)
    const bytes = new Blob([text]).size

    return [
      { label: 'Characters', value: chars },
      { label: 'Words', value: words },
      { label: 'Lines', value: lines },
      { label: 'Paragraphs', value: paragraphs },
      { label: 'Bytes', value: bytes },
      { label: 'Chars (no spaces)', value: charsNoSpaces }
    ]
  }, [input])

  return (
    <ToolLayout
      title="app.format.text"
      showCopy
      copyDisabled={!input}
      onCopy={() => copy(input)}
      showClear
      onClear={() => setInput('')}
    >
      <Flex gap={20} vertical>
        <Card title="Statistics">
          <Row gutter={[16, 16]}>
            {stats.map(item => (
              <Col xs={12} sm={8} lg={4} key={item.label}>
                <Statistic title={item.label} value={item.value} />
              </Col>
            ))}
          </Row>
        </Card>

        <Card title="Text Input" style={{ flex: 1 }}>
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter text to analyze..."
            autoSize={{ minRows: 6, maxRows: 12 }}
            style={{ fontFamily: 'monospace' }}
          />
        </Card>
      </Flex>
    </ToolLayout>
  )
}

export default TextStatClient
