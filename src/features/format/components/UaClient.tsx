'use client'

import { Card, Descriptions, Flex, Input, Typography } from 'antd'
import React, { useMemo, useState } from 'react'
import { UAParser } from 'ua-parser-js'

import ToolLayout from '@/components/ToolLayout'

const defaultUA = typeof navigator !== 'undefined' ? navigator.userAgent : ''

const UaClient = () => {
  const [input, setInput] = useState(defaultUA)

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    const parser = new UAParser(input)
    return parser.getResult()
  }, [input])

  return (
    <ToolLayout title="app.format.ua" showClear onClear={() => setInput('')}>
      <Flex vertical gap={20}>
        <Card title="User Agent String">
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste a User Agent string here..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ fontFamily: 'monospace' }}
          />
        </Card>

        {parsed && (
          <Card title="Parsed Result">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Browser">
                <Typography.Text>
                  {parsed.browser.name || 'Unknown'} {parsed.browser.version}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Engine">
                <Typography.Text>
                  {parsed.engine.name || 'Unknown'} {parsed.engine.version}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="OS">
                <Typography.Text>
                  {parsed.os.name || 'Unknown'} {parsed.os.version}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Device">
                <Typography.Text>
                  {parsed.device.vendor || ''} {parsed.device.model || ''} (
                  {parsed.device.type || 'desktop'})
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="CPU Architecture">
                <Typography.Text>{parsed.cpu.architecture || 'Unknown'}</Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Flex>
    </ToolLayout>
  )
}

export default UaClient
