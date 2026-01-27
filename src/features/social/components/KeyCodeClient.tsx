'use client'

import { Card, Descriptions, Flex, theme as antTheme, Typography } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'

import ToolLayout from '@/components/ToolLayout'

interface KeyInfo {
  key: string
  code: string
  keyCode: number
  which: number
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

const KeyCodeClient = () => {
  const { token: theme } = antTheme.useToken()
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    setKeyInfo({
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <ToolLayout title="app.social.keycode">
      <Flex vertical gap={20} align="center">
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            height: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colorBgLayout,
            borderRadius: 12,
            border: `2px dashed ${theme.colorBorder}`
          }}
        >
          <Typography.Title level={1} style={{ margin: 0, fontFamily: 'monospace' }}>
            {keyInfo ? keyInfo.key : 'Press any key...'}
          </Typography.Title>
        </div>

        {keyInfo && (
          <Card style={{ width: '100%', maxWidth: 600 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="event.key">
                <Typography.Text code>{keyInfo.key}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="event.code">
                <Typography.Text code>{keyInfo.code}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="event.keyCode">
                <Typography.Text code>{keyInfo.keyCode}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="event.which">
                <Typography.Text code>{keyInfo.which}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="altKey">
                <Typography.Text code>{String(keyInfo.altKey)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="ctrlKey">
                <Typography.Text code>{String(keyInfo.ctrlKey)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="shiftKey">
                <Typography.Text code>{String(keyInfo.shiftKey)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="metaKey">
                <Typography.Text code>{String(keyInfo.metaKey)}</Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Flex>
    </ToolLayout>
  )
}

export default KeyCodeClient
