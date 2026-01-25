'use client'

import { ClearOutlined, CopyOutlined, FormatPainterOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, Flex, Input, Row, Select, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'sql-formatter'

import { useCopy } from '@/hooks/useCopy'

type SqlLanguage =
  | 'sql'
  | 'mysql'
  | 'postgresql'
  | 'sqlite'
  | 'mariadb'
  | 'bigquery'
  | 'snowflake'
  | 'hive'

type KeywordCase = 'upper' | 'lower' | 'preserve'

const languageOptions: { label: string; value: SqlLanguage }[] = [
  { label: 'Standard SQL', value: 'sql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'BigQuery', value: 'bigquery' },
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'Hive', value: 'hive' }
]

const caseOptions: { label: string; value: KeywordCase }[] = [
  { label: 'UPPERCASE', value: 'upper' },
  { label: 'lowercase', value: 'lower' },
  { label: 'Preserve', value: 'preserve' }
]

const SqlClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [language, setLanguage] = useState<SqlLanguage>('sql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('upper')
  const [error, setError] = useState<string | null>(null)

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      message.warning(t('app.format.sql.empty'))
      return
    }
    try {
      const formatted = format(input, {
        language,
        keywordCase,
        tabWidth: 2
      })
      setOutput(formatted)
      setError(null)
      message.success(t('public.success'))
    } catch (e) {
      const err = e as Error
      setError(err.message)
      setOutput('')
    }
  }, [input, language, keywordCase, message, t])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card
        title={t('app.format.sql')}
        extra={
          <Flex gap={8} wrap>
            <Select
              value={language}
              onChange={setLanguage}
              options={languageOptions}
              style={{ width: 140 }}
            />
            <Select
              value={keywordCase}
              onChange={setKeywordCase}
              options={caseOptions}
              style={{ width: 120 }}
            />
            <Button type="primary" icon={<FormatPainterOutlined />} onClick={handleFormat}>
              {t('app.format.json.format')}
            </Button>
            <Button icon={<CopyOutlined />} onClick={() => copy(output)} disabled={!output}>
              {t('app.generation.uuid.copy')}
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              {t('app.format.json.clear')}
            </Button>
          </Flex>
        }
      >
        {error && (
          <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
            {t('app.format.json.error')}: {error}
          </Typography.Text>
        )}
      </Card>

      <Row gutter={16} style={{ flex: 1 }}>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title={t('app.format.sql.input')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('app.format.sql.input_placeholder')}
              style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            title={t('app.format.sql.output')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
          >
            <Input.TextArea
              value={output}
              readOnly
              placeholder={t('app.format.sql.output_placeholder')}
              style={{ flex: 1, resize: 'none', fontFamily: 'monospace' }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default SqlClient
