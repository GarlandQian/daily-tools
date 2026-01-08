'use client'

import { CopyOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Input,
  Radio,
  Row,
  Space,
  Statistic,
  theme as antTheme,
  Typography
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TimestampUnit = 'seconds' | 'milliseconds'

const TimestampClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { token: theme } = antTheme.useToken()

  // Use lazy initializer to set initial timestamp - avoids setState in useEffect
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())
  const [isPaused, setIsPaused] = useState(false)
  const [unit, setUnit] = useState<TimestampUnit>('seconds')

  // Input fields
  const [inputTimestamp, setInputTimestamp] = useState('')
  const [inputDate, setInputDate] = useState<dayjs.Dayjs | null>(null)

  // Update current timestamp every second when not paused
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [isPaused])

  const displayTimestamp = useMemo(() => {
    return unit === 'seconds' ? Math.floor(currentTimestamp / 1000) : currentTimestamp
  }, [currentTimestamp, unit])

  const currentDateStr = useMemo(() => {
    return dayjs(currentTimestamp).format('YYYY-MM-DD HH:mm:ss')
  }, [currentTimestamp])

  // Convert timestamp to date
  const convertedDate = useMemo(() => {
    if (!inputTimestamp) return null
    const ts = parseInt(inputTimestamp)
    if (isNaN(ts)) return null
    // Auto-detect unit: if length > 10, assume milliseconds
    const ms = inputTimestamp.length > 10 ? ts : ts * 1000
    return dayjs(ms)
  }, [inputTimestamp])

  // Convert date to timestamp
  const convertedTimestamp = useMemo(() => {
    if (!inputDate) return null
    return {
      seconds: Math.floor(inputDate.valueOf() / 1000),
      milliseconds: inputDate.valueOf()
    }
  }, [inputDate])

  const handleCopy = useCallback(
    (text: string | number) => {
      navigator.clipboard.writeText(String(text))
      message.success(t('app.social.retires.copy_success'))
    },
    [message, t]
  )

  return (
    <Flex className="size-full" gap={20} vertical>
      {/* Current Timestamp */}
      <Card title={t('app.converter.timestamp.current')}>
        <Flex align="center" gap={24} wrap>
          <Statistic
            title={t('app.converter.timestamp.now')}
            value={displayTimestamp}
            valueStyle={{ fontFamily: 'monospace', fontSize: 28 }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 16 }}>
            {currentDateStr}
          </Typography.Text>
          <Space>
            <Radio.Group value={unit} onChange={e => setUnit(e.target.value)}>
              <Radio.Button value="seconds">{t('app.converter.timestamp.seconds')}</Radio.Button>
              <Radio.Button value="milliseconds">
                {t('app.converter.timestamp.milliseconds')}
              </Radio.Button>
            </Radio.Group>
            <Button
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? t('app.converter.timestamp.resume') : t('app.converter.timestamp.pause')}
            </Button>
            <Button icon={<CopyOutlined />} onClick={() => handleCopy(displayTimestamp)}>
              {t('app.generation.uuid.copy')}
            </Button>
          </Space>
        </Flex>
      </Card>

      <Row gutter={16} style={{ flex: 1 }}>
        {/* Timestamp to Date */}
        <Col xs={24} md={12}>
          <Card title={t('app.converter.timestamp.to_date')} style={{ height: '100%' }}>
            <Flex vertical gap={16}>
              <Input
                value={inputTimestamp}
                onChange={e => setInputTimestamp(e.target.value)}
                placeholder={t('app.converter.timestamp.input_ts')}
                style={{ fontFamily: 'monospace' }}
                size="large"
              />
              {convertedDate && convertedDate.isValid() && (
                <div
                  style={{
                    padding: 16,
                    background: theme.colorBgLayout,
                    borderRadius: 8
                  }}
                >
                  <Flex vertical gap={8}>
                    <Flex justify="space-between" align="center">
                      <Typography.Text strong>
                        {convertedDate.format('YYYY-MM-DD HH:mm:ss')}
                      </Typography.Text>
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(convertedDate.format('YYYY-MM-DD HH:mm:ss'))}
                      />
                    </Flex>
                    <Typography.Text type="secondary">
                      {convertedDate.format('dddd, MMMM D, YYYY')}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      ISO: {convertedDate.toISOString()}
                    </Typography.Text>
                  </Flex>
                </div>
              )}
            </Flex>
          </Card>
        </Col>

        {/* Date to Timestamp */}
        <Col xs={24} md={12}>
          <Card title={t('app.converter.timestamp.to_ts')} style={{ height: '100%' }}>
            <Flex vertical gap={16}>
              <DatePicker
                showTime
                value={inputDate}
                onChange={setInputDate}
                style={{ width: '100%' }}
                size="large"
              />
              {convertedTimestamp && (
                <div
                  style={{
                    padding: 16,
                    background: theme.colorBgLayout,
                    borderRadius: 8
                  }}
                >
                  <Flex vertical gap={12}>
                    <Flex justify="space-between" align="center">
                      <div>
                        <Typography.Text type="secondary">
                          {t('app.converter.timestamp.seconds')}:
                        </Typography.Text>
                        <Typography.Text code style={{ marginLeft: 8, fontSize: 16 }}>
                          {convertedTimestamp.seconds}
                        </Typography.Text>
                      </div>
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(convertedTimestamp.seconds)}
                      />
                    </Flex>
                    <Flex justify="space-between" align="center">
                      <div>
                        <Typography.Text type="secondary">
                          {t('app.converter.timestamp.milliseconds')}:
                        </Typography.Text>
                        <Typography.Text code style={{ marginLeft: 8, fontSize: 16 }}>
                          {convertedTimestamp.milliseconds}
                        </Typography.Text>
                      </div>
                      <Button
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(convertedTimestamp.milliseconds)}
                      />
                    </Flex>
                  </Flex>
                </div>
              )}
            </Flex>
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default TimestampClient
