'use client'

import { Card, Col, Flex, Input, Row, Typography } from 'antd'
import {
  camelCase,
  kebabCase,
  lowerCase,
  snakeCase,
  startCase,
  toUpper,
  upperFirst
} from 'lodash-es'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

const CaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')

  const conversions = useMemo(() => {
    if (!input.trim()) return []

    const text = input.trim()

    return [
      { label: 'camelCase', value: camelCase(text) },
      { label: 'PascalCase', value: upperFirst(camelCase(text)) },
      { label: 'snake_case', value: snakeCase(text) },
      { label: 'kebab-case', value: kebabCase(text) },
      { label: 'CONSTANT_CASE', value: snakeCase(text).toUpperCase() },
      { label: 'UPPER CASE', value: toUpper(text) },
      { label: 'lower case', value: lowerCase(text) },
      { label: 'Title Case', value: startCase(camelCase(text)) },
      { label: 'Sentence case', value: upperFirst(lowerCase(text)) },
      { label: 'Dot Case', value: lowerCase(text).replace(/ /g, '.') },
      { label: 'Path Case', value: lowerCase(text).replace(/ /g, '/') }
    ]
  }, [input])

  return (
    <ToolLayout title="app.format.case" showClear onClear={() => setInput('')}>
      <Flex gap={20} vertical>
        <Card title="Input">
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter text to convert..."
            autoSize={{ minRows: 3, maxRows: 6 }}
            style={{ fontFamily: 'monospace' }}
          />
        </Card>

        <Row gutter={[16, 16]}>
          {conversions.map(item => (
            <Col xs={24} sm={12} lg={8} key={item.label}>
              <Card
                size="small"
                title={item.label}
                extra={
                  <Typography.Link onClick={() => copy(item.value)}>
                    {t('app.generation.uuid.copy')}
                  </Typography.Link>
                }
              >
                <Typography.Text copyable={false} ellipsis={{ tooltip: true }}>
                  {item.value}
                </Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Flex>
    </ToolLayout>
  )
}

export default CaseClient
