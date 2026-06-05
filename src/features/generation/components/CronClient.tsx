'use client'

import CronParser from 'cron-parser'
import dayjs from 'dayjs'
import { Copy, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

interface CronFormData {
  second: string
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

const commonOptionValues = ['*', '0', '1', '5', '10', '15', '30']
const weekdayOptionValues = ['*', '0', '1', '2', '3', '4', '5', '6']

const CronClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const commonOptions = useMemo(
    () =>
      commonOptionValues.map(value => ({
        label: value === '*' ? t('app.generation.cron.every') : value,
        value
      })),
    [t]
  )
  const weekdayOptions = useMemo(
    () =>
      weekdayOptionValues.map(value => ({
        label:
          value === '*'
            ? t('app.generation.cron.every_day')
            : t(`app.generation.cron.weekday.${value}`),
        value
      })),
    [t]
  )

  const [formData, setFormData] = useState<CronFormData>({
    second: '0',
    minute: '0',
    hour: '*',
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: '*'
  })

  const cronExpression = useMemo(() => {
    return `${formData.second} ${formData.minute} ${formData.hour} ${formData.dayOfMonth} ${formData.month} ${formData.dayOfWeek}`
  }, [formData])

  const nextExecutions = useMemo(() => {
    try {
      const parts = cronExpression.split(' ')
      if (parts.length === 6) {
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
    toast.success(t('public.copy.success'))
  }, [cronExpression, toast, t])

  const handleReset = useCallback(() => {
    setFormData({
      second: '0',
      minute: '0',
      hour: '*',
      dayOfMonth: '*',
      month: '*',
      dayOfWeek: '*'
    })
  }, [])

  return (
    <div className="size-full flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.cron')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-3">
              <Label htmlFor="second">{t('app.generation.cron.second')}</Label>
              <Select
                id="second"
                value={formData.second}
                onChange={e => setFormData(prev => ({ ...prev, second: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="minute">{t('app.generation.cron.minute')}</Label>
              <Select
                id="minute"
                value={formData.minute}
                onChange={e => setFormData(prev => ({ ...prev, minute: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="hour">{t('app.generation.cron.hour')}</Label>
              <Select
                id="hour"
                value={formData.hour}
                onChange={e => setFormData(prev => ({ ...prev, hour: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="dayOfMonth">{t('app.generation.cron.day')}</Label>
              <Select
                id="dayOfMonth"
                value={formData.dayOfMonth}
                onChange={e => setFormData(prev => ({ ...prev, dayOfMonth: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="month">{t('app.generation.cron.month')}</Label>
              <Select
                id="month"
                value={formData.month}
                onChange={e => setFormData(prev => ({ ...prev, month: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="dayOfWeek">{t('app.generation.cron.weekday')}</Label>
              <Select
                id="dayOfWeek"
                value={formData.dayOfWeek}
                onChange={e => setFormData(prev => ({ ...prev, dayOfWeek: e.target.value }))}
              >
                {weekdayOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
              {t('public.copy')}
            </Button>
            <Button icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset}>
              {t('app.generation.cron.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.cron.expression')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={cronExpression} readOnly className="font-mono text-lg text-center" />
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>{t('app.generation.cron.next')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {nextExecutions.length > 0 ? (
              nextExecutions.map((time, index) => (
                <code key={index} className="text-sm text-[var(--text-primary)]">
                  {index + 1}. {time}
                </code>
              ))
            ) : (
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.generation.cron.invalid')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CronClient
