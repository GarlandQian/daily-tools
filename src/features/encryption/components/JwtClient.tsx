'use client'

import { ClearOutlined, SafetyOutlined } from '@ant-design/icons'
import { Button, Card, Col, Flex, Input, Row, theme as antTheme, Typography } from 'antd'
import { jwtDecode } from 'jwt-decode'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface JwtPayload {
  [key: string]: unknown
}

interface DecodedResult {
  decoded: { header: unknown; payload: JwtPayload } | null
  error: string | null
  expTimestamp: number | null
}

const JwtClient = () => {
  const { t } = useTranslation()
  const { token: theme } = antTheme.useToken()

  const [token, setToken] = useState('')
  const [checkTime, setCheckTime] = useState<number | null>(null)

  const { decoded, error, expTimestamp }: DecodedResult = useMemo(() => {
    if (!token.trim()) {
      return { decoded: null, error: null, expTimestamp: null }
    }

    try {
      // Decode header
      const parts = token.split('.')
      if (parts.length !== 3) {
        return {
          decoded: null,
          error: t('app.encryption.jwt.invalid_format'),
          expTimestamp: null
        }
      }

      const header = JSON.parse(atob(parts[0]))
      const payload = jwtDecode<JwtPayload>(token)

      // Get expiration timestamp if exists
      const expTs = payload.exp ? (payload.exp as number) * 1000 : null

      return { decoded: { header, payload }, error: null, expTimestamp: expTs }
    } catch (e) {
      const err = e as Error
      return { decoded: null, error: err.message, expTimestamp: null }
    }
  }, [token, t])

  // Calculate expiration status based on checkTime
  const isExpired = useMemo(() => {
    if (expTimestamp === null || checkTime === null) return null
    return checkTime >= expTimestamp
  }, [expTimestamp, checkTime])

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToken(e.target.value)
    // Capture time when token changes
    setCheckTime(Date.now())
  }, [])

  const handleClear = useCallback(() => {
    setToken('')
    setCheckTime(null)
  }, [])

  const formatJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card
        title={t('app.encryption.jwt')}
        extra={
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            {t('app.format.json.clear')}
          </Button>
        }
      >
        <Input.TextArea
          value={token}
          onChange={handleTokenChange}
          placeholder={t('app.encryption.jwt.placeholder')}
          rows={4}
          style={{ fontFamily: 'monospace' }}
        />
        {error && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            {t('app.format.json.error')}: {error}
          </Typography.Text>
        )}
        {isExpired !== null && (
          <Flex align="center" gap={8} style={{ marginTop: 8 }}>
            <SafetyOutlined style={{ color: isExpired ? theme.colorError : theme.colorSuccess }} />
            <Typography.Text type={isExpired ? 'danger' : 'success'}>
              {isExpired ? t('app.encryption.jwt.expired') : t('app.encryption.jwt.valid')}
            </Typography.Text>
          </Flex>
        )}
      </Card>

      <Row gutter={16} style={{ flex: 1 }}>
        <Col xs={24} md={12}>
          <Card
            title="Header"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'auto' } }}
          >
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: theme.colorBgLayout,
                padding: 12,
                borderRadius: 8
              }}
            >
              {decoded ? formatJson(decoded.header) : '{}'}
            </pre>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title="Payload"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'auto' } }}
          >
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: theme.colorBgLayout,
                padding: 12,
                borderRadius: 8
              }}
            >
              {decoded ? formatJson(decoded.payload) : '{}'}
            </pre>
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default JwtClient
