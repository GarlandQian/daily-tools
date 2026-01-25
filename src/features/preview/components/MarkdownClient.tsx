'use client'

import { Card, Col, Input, Row, theme as antTheme } from 'antd'
import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

const defaultMarkdown = `# Markdown Preview

You can write **bold** text, *italic* text, and even [links](https://github.com).

## Lists

- Item 1
- Item 2
- Item 3

## Code

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## Tables

| Header 1 | Header 2 |
|Data 1    | Data 2 |
`

const MarkdownClient = () => {
  const { copy } = useCopy()
  const { token: theme } = antTheme.useToken()

  const [input, setInput] = useState(defaultMarkdown)

  return (
    <ToolLayout
      title="app.preview.markdown"
      showCopy
      copyDisabled={!input}
      onCopy={() => copy(input)}
      showClear
      onClear={() => setInput('')}
    >
      <Row gutter={16} style={{ height: 'calc(100vh - 250px)', minHeight: 500 }}>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title="Editor"
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ flex: 1, resize: 'none', fontFamily: 'monospace', fontSize: 14 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title="Preview"
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'auto', background: theme.colorBgLayout } }}
          >
            <div className="markdown-body" style={{ color: theme.colorText }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{input}</ReactMarkdown>
            </div>
          </Card>
        </Col>
      </Row>
    </ToolLayout>
  )
}

export default MarkdownClient
