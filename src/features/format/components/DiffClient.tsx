'use client'

import { ClearOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Card, Col, Flex, Input, Row, theme as antTheme, Typography } from 'antd'
import * as Diff from 'diff'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

const DiffClient = () => {
  const { t } = useTranslation()
  const { token: theme } = antTheme.useToken()

  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')

  const diffResult = useMemo(() => {
    if (!oldText && !newText) return []
    return Diff.diffChars(oldText, newText) as DiffPart[]
  }, [oldText, newText])

  const handleSwap = useCallback(() => {
    setOldText(newText)
    setNewText(oldText)
  }, [oldText, newText])

  const handleClear = useCallback(() => {
    setOldText('')
    setNewText('')
  }, [])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    diffResult.forEach(part => {
      if (part.added) added += part.value.length
      if (part.removed) removed += part.value.length
    })
    return { added, removed }
  }, [diffResult])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card
        title={t('app.format.diff')}
        extra={
          <Flex gap={8}>
            <Button icon={<SwapOutlined />} onClick={handleSwap}>
              {t('app.format.diff.swap')}
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              {t('app.format.json.clear')}
            </Button>
          </Flex>
        }
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('app.format.diff.original')}
            </Typography.Text>
            <Input.TextArea
              value={oldText}
              onChange={e => setOldText(e.target.value)}
              placeholder={t('app.format.diff.original_placeholder')}
              rows={8}
              style={{ fontFamily: 'monospace' }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('app.format.diff.modified')}
            </Typography.Text>
            <Input.TextArea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder={t('app.format.diff.modified_placeholder')}
              rows={8}
              style={{ fontFamily: 'monospace' }}
            />
          </Col>
        </Row>
      </Card>

      <Card
        title={t('app.format.diff.result')}
        extra={
          <Typography.Text type="secondary">
            <span style={{ color: theme.colorSuccess }}>+{stats.added}</span>
            {' / '}
            <span style={{ color: theme.colorError }}>-{stats.removed}</span>
          </Typography.Text>
        }
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'auto' } }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.6
          }}
        >
          {diffResult.map((part, index) => {
            let style: React.CSSProperties = {}
            if (part.added) {
              style = {
                backgroundColor: `${theme.colorSuccess}22`,
                color: theme.colorSuccess,
                textDecoration: 'none'
              }
            } else if (part.removed) {
              style = {
                backgroundColor: `${theme.colorError}22`,
                color: theme.colorError,
                textDecoration: 'line-through'
              }
            }
            return (
              <span key={index} style={style}>
                {part.value}
              </span>
            )
          })}
        </div>
      </Card>
    </Flex>
  )
}

export default DiffClient
