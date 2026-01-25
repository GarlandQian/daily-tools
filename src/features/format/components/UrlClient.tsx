'use client'

import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Flex, Input, Row, Select, Table, Typography } from 'antd'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

interface QueryParam {
  key: string
  value: string
  id: string
}

const UrlClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [inputUrl, setInputUrl] = useState('')
  const [protocol, setProtocol] = useState('https:')
  const [host, setHost] = useState('')
  const [pathname, setPathname] = useState('')
  const [hash, setHash] = useState('')
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [error, setError] = useState<string | null>(null)

  // Parse URL when input changes
  const handleParse = useCallback(() => {
    if (!inputUrl.trim()) return

    try {
      const url = new URL(inputUrl)
      setProtocol(url.protocol)
      setHost(url.host)
      setPathname(url.pathname)
      setHash(url.hash)

      const params: QueryParam[] = []
      url.searchParams.forEach((value, key) => {
        params.push({ key, value, id: Math.random().toString(36).substr(2, 9) })
      })
      setQueryParams(params)
      setError(null)
    } catch {
      setError(t('app.converter.base.invalid'))
    }
  }, [inputUrl, t])

  // Reconstruct URL when components change
  const constructedUrl = React.useMemo(() => {
    try {
      if (!host) return ''

      const url = new URL('https://example.com') // Dymmy base
      url.protocol = protocol
      url.host = host
      url.pathname = pathname
      url.hash = hash

      // Clear existing params
      url.search = ''
      queryParams.forEach(p => {
        if (p.key) url.searchParams.append(p.key, p.value)
      })

      return url.toString()
    } catch {
      return ''
    }
  }, [protocol, host, pathname, hash, queryParams])

  const handleParamChange = (id: string, field: 'key' | 'value', value: string) => {
    setQueryParams(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleAddParam = () => {
    setQueryParams(prev => [
      ...prev,
      { key: '', value: '', id: Math.random().toString(36).substr(2, 9) }
    ])
  }

  const handleDeleteParam = (id: string) => {
    setQueryParams(prev => prev.filter(p => p.id !== id))
  }

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (text: string, record: QueryParam) => (
        <Input
          value={text}
          onChange={e => handleParamChange(record.id, 'key', e.target.value)}
          variant="borderless"
        />
      )
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (text: string, record: QueryParam) => (
        <Input
          value={text}
          onChange={e => handleParamChange(record.id, 'value', e.target.value)}
          variant="borderless"
        />
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: unknown, record: QueryParam) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteParam(record.id)}
        />
      )
    }
  ]

  return (
    <Flex className="size-full" gap={20} vertical>
      <ToolLayout
        title="app.format.url"
        showCopy
        copyDisabled={!constructedUrl}
        onCopy={() => copy(constructedUrl)}
        showClear
        onClear={() => {
          setInputUrl('')
          setProtocol('https:')
          setHost('')
          setPathname('')
          setHash('')
          setQueryParams([])
          setError(null)
        }}
        showReset
        onReset={() => {
          setInputUrl('')
          // Reset to defaults
        }}
      >
        <Flex gap={16}>
          <Input.TextArea
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="https://example.com/path?query=123"
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ flex: 1, fontFamily: 'monospace' }}
          />
          <Button type="primary" onClick={handleParse} icon={<ReloadOutlined />}>
            Parse
          </Button>
        </Flex>
        {error && <Typography.Text type="danger">{error}</Typography.Text>}
      </ToolLayout>

      <Row gutter={16} style={{ flex: 1 }}>
        <Col xs={24} lg={12}>
          <Card title="URL Components" style={{ height: '100%' }}>
            <Flex vertical gap={16}>
              <div>
                <Typography.Text type="secondary">Protocol</Typography.Text>
                <Select
                  value={protocol}
                  onChange={setProtocol}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'http:', label: 'http://' },
                    { value: 'https:', label: 'https://' },
                    { value: 'ftp:', label: 'ftp://' },
                    { value: 'ws:', label: 'ws://' },
                    { value: 'wss:', label: 'wss://' }
                  ]}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Host</Typography.Text>
                <Input value={host} onChange={e => setHost(e.target.value)} />
              </div>
              <div>
                <Typography.Text type="secondary">Path</Typography.Text>
                <Input value={pathname} onChange={e => setPathname(e.target.value)} />
              </div>
              <div>
                <Typography.Text type="secondary">Hash</Typography.Text>
                <Input value={hash} onChange={e => setHash(e.target.value)} />
              </div>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Query Parameters"
            style={{ height: '100%' }}
            extra={
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddParam}>
                Add
              </Button>
            }
          >
            <Table
              dataSource={queryParams}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Constructed URL">
        <Typography.Paragraph copyable={{ text: constructedUrl }}>
          <Typography.Text code className="text-lg">
            {constructedUrl || 'Wait for input...'}
          </Typography.Text>
        </Typography.Paragraph>
      </Card>
    </Flex>
  )
}

export default UrlClient
