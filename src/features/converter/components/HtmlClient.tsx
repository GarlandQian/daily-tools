'use client'

import { SwapOutlined } from '@ant-design/icons'
import { Button, Card, Col, Flex, Input, Radio, Row } from 'antd'
import he from 'he'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

type Mode = 'encode' | 'decode'

const HtmlClient = () => {
  useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('encode')
  const [output, setOutput] = useState('')

  const handleConvert = useCallback(() => {
    if (!input) {
      setOutput('')
      return
    }

    try {
      const result =
        mode === 'encode' ? he.encode(input, { useNamedReferences: true }) : he.decode(input)
      setOutput(result)
    } catch (e) {
      console.error(e)
    }
  }, [input, mode])

  const handleSwap = () => {
    setInput(output)
    setOutput('')
    setMode(prev => (prev === 'encode' ? 'decode' : 'encode'))
  }

  return (
    <ToolLayout
      title="app.converter.html"
      showCopy
      copyDisabled={!output}
      onCopy={() => copy(output)}
      showClear
      onClear={() => {
        setInput('')
        setOutput('')
      }}
    >
      <Flex gap={20} vertical className="h-full">
        <Flex justify="center" align="center" gap={16}>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)} buttonStyle="solid">
            <Radio.Button value="encode">Encode</Radio.Button>
            <Radio.Button value="decode">Decode</Radio.Button>
          </Radio.Group>
          <Button icon={<SwapOutlined />} onClick={handleSwap}>
            Swap
          </Button>
          <Button type="primary" onClick={handleConvert}>
            Convert
          </Button>
        </Flex>

        <Row gutter={16} style={{ flex: 1 }}>
          <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
            <Card
              title="Input"
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
            >
              <Input.TextArea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  mode === 'encode'
                    ? '<p>Hello & World</p>'
                    : '&lt;p&gt;Hello &amp; World&lt;/p&gt;'
                }
                style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
            <Card
              title="Output"
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
            >
              <Input.TextArea
                value={output}
                readOnly
                placeholder="Result will appear here..."
                style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
              />
            </Card>
          </Col>
        </Row>
      </Flex>
    </ToolLayout>
  )
}

export default HtmlClient
