'use client'
import { CopyOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Progress, Radio, theme as antTheme,Typography } from 'antd'
import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { calcRetires, type calcRetiresParams, type calcRetiresReturnType } from '../utils'



const RetiresClient = () => {
  const { token: theme } = antTheme.useToken()
  const { t } = useTranslation()

  const [form] = Form.useForm<calcRetiresParams>()
  const gender = Form.useWatch('gender', form)
  const birth = Form.useWatch('birth', form)
  const isFemale = useMemo(() => gender === 'female', [gender])

  const [retirement, setRetirement] = useState<calcRetiresReturnType>()
  const onFinish = (values: calcRetiresParams) => {
    setRetirement(calcRetires(values))
  }

  // Calculate Extra Stats
  const stats = useMemo(() => {
    if (!retirement || !birth) return null
    const birthDay = dayjs(birth)
    const retireDay = dayjs(retirement.retirementDate)
    const now = dayjs()

    const totalDays = retireDay.diff(birthDay, 'day')
    const elapsedDays = now.diff(birthDay, 'day')
    const remainingDays = retireDay.diff(now, 'day')

    let percent = (elapsedDays / totalDays) * 100
    if (percent < 0) percent = 0
    if (percent > 100) percent = 100

    return {
      percent: percent.toFixed(2),
      remainingDays: remainingDays > 0 ? remainingDays : 0,
      retireYear: retireDay.year(),
      retireDateStr: retireDay.format('YYYY-MM-DD')
    }
  }, [retirement, birth])

  const resultText = useMemo(() => {
    if (!retirement) return ''
    const dateStr = dayjs(retirement.retirementDate).format('YYYY年MM月DD日')
    if (retirement.newRetirementPolicy) {
      const monthStr = retirement.baseRetirementMonth ? `${retirement.baseRetirementMonth}月` : ''
      return `退休时间为${dateStr}。到时你已${retirement.baseRetirementAge}岁${monthStr}。`
    } else {
      return `退休时间为${dateStr}。到时你已${retirement.baseRetirementAge}岁。`
    }
  }, [retirement])

  return (
    <>
      <Form
        labelAlign="left"
        layout="horizontal"
        form={form}
        labelCol={{ xs: { span: 24 }, sm: { span: 6 }, md: { span: 4 } }}
        wrapperCol={{ xs: { span: 24 }, sm: { span: 18 }, md: { span: 16 } }}
        onFinish={onFinish}
      >
        <Form.Item
          name="birth"
          label={t('app.social.retires.birthday')}
          rules={[
            {
              required: true,
              message: t('rules.msg.required', {
                msg: t('app.social.retires.birthday')
              })
            }
          ]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="gender"
          label={t('app.social.retires.gender')}
          rules={[{ required: true, message: 'Please select your gender!' }]}
        >
          <Radio.Group
            options={[
              { label: t('app.social.retires.male'), value: 'male' },
              { label: t('app.social.retires.female'), value: 'female' }
            ]}
          />
        </Form.Item>
        {isFemale && (
          <Form.Item
            name="occupation"
            label={t('app.social.retires.occupation')}
            rules={[{ required: true, message: 'Please select your occupation!' }]}
          >
            <Radio.Group
              options={[
                { label: t('app.social.retires.occupation.worker'), value: 'worker' },
                { label: t('app.social.retires.occupation.staff'), value: 'staff' }
              ]}
            />
          </Form.Item>
        )}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {t('public.submit')}
          </Button>
        </Form.Item>
      </Form>

      <AnimatePresence>
        {retirement && stats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mt-10 flex justify-center"
          >
            <div
              className={`w-full max-w-[700px] rounded-3xl p-8 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[var(--primary-color)] before:to-transparent before:animate-[scan_2s_linear_infinite]`}
              style={{
                background: theme.colorBgContainer,
                border: `1px solid ${theme.colorBorderSecondary}`,
                boxShadow: theme.boxShadowSecondary,
                color: theme.colorText,
                '--primary-color': theme.colorPrimary
              } as React.CSSProperties}
            >
              <div style={{ textAlign: 'center' }}>
                <Typography.Title level={4} style={{ margin: 0, opacity: 0.7 }}>
                  {t('app.social.retires.target')}
                </Typography.Title>
                <div
                  className="text-[32px] font-extrabold my-[10px]"
                  style={{ color: theme.colorPrimary }}
                >
                  {stats.retireDateStr}
                </div>
                <Typography.Text type="secondary">
                   {retirement.newRetirementPolicy ? t('app.social.retires.policy.new') : t('app.social.retires.policy.std')}
                </Typography.Text>
              </div>

              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                   <Typography.Text strong>{t('app.social.retires.progress')}</Typography.Text>
                   <Typography.Text type="secondary">{stats.percent}%</Typography.Text>
                </div>
                <Progress
                  percent={parseFloat(stats.percent)}
                  showInfo={false}
                  strokeColor={{
                    '0%': theme.colorPrimary,
                    '100%': '#f9c61a',
                  }}
                  size={['100%', 12]}
                  railColor="rgba(0,0,0,0.05)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: theme.colorBgLayout,
                    border: `1px solid ${theme.colorBorderSecondary}`
                  }}
                >
                  <div
                    className="text-sm mb-1"
                    style={{ color: theme.colorTextSecondary }}
                  >
                    {t('app.social.retires.age')}
                  </div>
                  <div
                    className="text-[20px] font-semibold"
                    style={{ color: theme.colorText }}
                  >
                    {retirement.baseRetirementAge}
                    <span style={{fontSize: 14, fontWeight: 400}}> Y </span>
                    {retirement.baseRetirementMonth > 0 && (
                      <>
                        {retirement.baseRetirementMonth}
                        <span style={{fontSize: 14, fontWeight: 400}}> M</span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: theme.colorBgLayout,
                    border: `1px solid ${theme.colorBorderSecondary}`
                  }}
                >
                  <div
                    className="text-sm mb-1"
                    style={{ color: theme.colorTextSecondary }}
                  >
                    {t('app.social.retires.remaining')}
                  </div>
                  <div
                    className="text-[20px] font-semibold"
                    style={{
                      color: Number(stats.remainingDays) < 365 ? theme.colorSuccess : theme.colorText
                    }}
                  >
                    {stats.remainingDays.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 32, textAlign: 'center' }}>
                <Button
                  type="default"
                  shape="round"
                  size="large"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(resultText)
                    // Feedback could be added here
                  }}
                  style={{ minWidth: 200 }}
                >
                  {t('app.social.retires.copy')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default RetiresClient
