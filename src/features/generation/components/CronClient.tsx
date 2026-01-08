'use client'

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, Flex, Form, Input, Row, Select, Typography } from 'antd'
import CronParser from 'cron-parser'
import dayjs from 'dayjs'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CronForm {
  second: string
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

const commonOptions = [
  { label: '* (每)', value: '*' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '30', value: '30' }
]

const CronClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [form] = Form.useForm<CronForm>()

  const [cronExpression, setCronExpression] = useState('0 0 * * * *')

  const handleValuesChange = useCallback((_: Partial<CronForm>, allValues: CronForm) => {
    const expr = `${allValues.second} ${allValues.minute} ${allValues.hour} ${allValues.dayOfMonth} ${allValues.month} ${allValues.dayOfWeek}`
    setCronExpression(expr)
  }, [])

  const nextExecutions = useMemo(() => {
    try {
      // cron-parser uses 5-field format by default, we use 6-field (with seconds)
      const parts = cronExpression.split(' ')
      if (parts.length === 6) {
        // Convert to 5-field by removing seconds for parsing
        const fiveFieldExpr = parts.slice(1).join(' ')
        const interval = CronParser.parse(fiveFieldExpr, { tz: 'Asia/Shanghai' })
        const results: string[] = []
        for (let i = 0; i < 5; i++) {
          const next = interval.next()
          results.push(dayjs(next.toDate()).format('YYYY-MM-DD HH:mm:ss'))
        }
        return results
      }
      return []
    } catch {
      return []
    }
  }, [cronExpression])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cronExpression)
    message.success(t('app.social.retires.copy_success'))
  }, [cronExpression, message, t])

  const handleReset = useCallback(() => {
    form.setFieldsValue({
      second: '0',
      minute: '0',
      hour: '*',
      dayOfMonth: '*',
      month: '*',
      dayOfWeek: '*'
    })
    setCronExpression('0 0 * * * *')
  }, [form])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.generation.cron')}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            second: '0',
            minute: '0',
            hour: '*',
            dayOfMonth: '*',
            month: '*',
            dayOfWeek: '*'
          }}
          onValuesChange={handleValuesChange}
        >
          <Row gutter={16}>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.second')} name="second">
                <Select options={commonOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.minute')} name="minute">
                <Select options={commonOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.hour')} name="hour">
                <Select options={commonOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.day')} name="dayOfMonth">
                <Select options={commonOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.month')} name="month">
                <Select options={commonOptions} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Form.Item label={t('app.generation.cron.weekday')} name="dayOfWeek">
                <Select
                  options={[
                    { label: '* (每天)', value: '*' },
                    { label: '0 (周日)', value: '0' },
                    { label: '1 (周一)', value: '1' },
                    { label: '2 (周二)', value: '2' },
                    { label: '3 (周三)', value: '3' },
                    { label: '4 (周四)', value: '4' },
                    { label: '5 (周五)', value: '5' },
                    { label: '6 (周六)', value: '6' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Flex gap={10}>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              {t('app.generation.uuid.copy')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              {t('app.generation.cron.reset')}
            </Button>
          </Flex>
        </Form>
      </Card>

      <Card title={t('app.generation.cron.expression')}>
        <Input
          value={cronExpression}
          readOnly
          style={{ fontFamily: 'monospace', fontSize: 18, textAlign: 'center' }}
          size="large"
        />
      </Card>

      <Card title={t('app.generation.cron.next')} style={{ flex: 1 }}>
        <Flex vertical gap={8}>
          {nextExecutions.length > 0 ? (
            nextExecutions.map((time, index) => (
              <Typography.Text key={index} code style={{ fontSize: 14 }}>
                {index + 1}. {time}
              </Typography.Text>
            ))
          ) : (
            <Typography.Text type="secondary">{t('app.generation.cron.invalid')}</Typography.Text>
          )}
        </Flex>
      </Card>
    </Flex>
  )
}

export default CronClient
