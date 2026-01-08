'use client'

import { ClearOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Table,
  theme as antTheme,
  Typography
} from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface RegexForm {
  pattern: string
  flags: string[]
  testText: string
}

interface MatchResult {
  key: number
  index: number
  match: string
  groups: string
}

const RegexClient = () => {
  const { t } = useTranslation()
  const { token: theme } = antTheme.useToken()
  const [form] = Form.useForm<RegexForm>()

  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<string[]>(['g'])
  const [testText, setTestText] = useState('')

  const { matches, highlightedText, error } = useMemo(() => {
    if (!pattern || !testText) {
      return { matches: [], highlightedText: testText, error: null }
    }

    try {
      const flagStr = flags.join('')
      const regex = new RegExp(pattern, flagStr)

      const matchResults: MatchResult[] = []
      let highlighted = testText
      let match: RegExpExecArray | null
      let key = 0

      if (flagStr.includes('g')) {
        const allMatches: Array<{ index: number; value: string; groups: string[] }> = []
        while ((match = regex.exec(testText)) !== null) {
          allMatches.push({
            index: match.index,
            value: match[0],
            groups: match.slice(1)
          })
          matchResults.push({
            key: key++,
            index: match.index,
            match: match[0],
            groups: match.slice(1).join(', ') || '-'
          })
          // Prevent infinite loop for zero-length matches
          if (match[0].length === 0) {
            regex.lastIndex++
          }
        }

        // Build highlighted text
        let result = ''
        let lastIndex = 0
        allMatches.forEach(m => {
          result += testText.slice(lastIndex, m.index)
          result += `<mark style="background-color: ${theme.colorWarningBg}; color: ${theme.colorWarningText}; padding: 0 2px; border-radius: 2px;">${m.value}</mark>`
          lastIndex = m.index + m.value.length
        })
        result += testText.slice(lastIndex)
        highlighted = result
      } else {
        match = regex.exec(testText)
        if (match) {
          matchResults.push({
            key: 0,
            index: match.index,
            match: match[0],
            groups: match.slice(1).join(', ') || '-'
          })
          highlighted =
            testText.slice(0, match.index) +
            `<mark style="background-color: ${theme.colorWarningBg}; color: ${theme.colorWarningText}; padding: 0 2px; border-radius: 2px;">${match[0]}</mark>` +
            testText.slice(match.index + match[0].length)
        }
      }

      return { matches: matchResults, highlightedText: highlighted, error: null }
    } catch (e) {
      const err = e as Error
      return { matches: [], highlightedText: testText, error: err.message }
    }
  }, [pattern, flags, testText, theme])

  const handleClear = useCallback(() => {
    setPattern('')
    setFlags(['g'])
    setTestText('')
    form.resetFields()
  }, [form])

  const columns = [
    { title: t('app.format.regex.index'), dataIndex: 'index', key: 'index', width: 80 },
    { title: t('app.format.regex.match'), dataIndex: 'match', key: 'match' },
    { title: t('app.format.regex.groups'), dataIndex: 'groups', key: 'groups' }
  ]

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card
        title={t('app.format.regex')}
        extra={
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            {t('app.format.json.clear')}
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item label={t('app.format.regex.pattern')}>
                <Input
                  value={pattern}
                  onChange={e => setPattern(e.target.value)}
                  placeholder={t('app.format.regex.pattern_placeholder')}
                  style={{ fontFamily: 'monospace' }}
                  prefix="/"
                  suffix={`/${flags.join('')}`}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('app.format.regex.flags')}>
                <Checkbox.Group
                  value={flags}
                  onChange={val => setFlags(val as string[])}
                  options={[
                    { label: 'g (global)', value: 'g' },
                    { label: 'i (ignore case)', value: 'i' },
                    { label: 'm (multiline)', value: 'm' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('app.format.regex.test')}>
            <Input.TextArea
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder={t('app.format.regex.test_placeholder')}
              rows={4}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
        {error && (
          <Typography.Text type="danger">
            {t('app.format.json.error')}: {error}
          </Typography.Text>
        )}
      </Card>

      <Card title={t('app.format.regex.result')}>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.8,
            padding: 12,
            background: theme.colorBgLayout,
            borderRadius: 8,
            minHeight: 60
          }}
          dangerouslySetInnerHTML={{ __html: highlightedText || '&nbsp;' }}
        />
      </Card>

      <Card
        title={t('app.format.regex.matches')}
        style={{ flex: 1 }}
        extra={
          <Typography.Text type="secondary">
            {matches.length} {t('app.format.regex.matches_count')}
          </Typography.Text>
        }
      >
        <Table
          columns={columns}
          dataSource={matches}
          pagination={false}
          size="small"
          scroll={{ y: 200 }}
        />
      </Card>
    </Flex>
  )
}

export default RegexClient
