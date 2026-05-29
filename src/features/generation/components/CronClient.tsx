'use client'

import { Copy, RotateCcw } from 'lucide-react'
import CronParser from 'cron-parser'
import dayjs from 'dayjs'
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

const commonOptions = [
  { label: '* (每)', value: '*' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '30', value: '30' }
]

const weekdayOptions = [
  { label: '* (每天)', value: '*' },
  { label: '0 (周日)', value: '0' },
  { label: '1 (周一)', value: '1' },
  { label: '2 (周二)', value: '2' },
  { label: '3 (周三)', value: '3' },
  { label: '4 (周四)', value: '4' },
  { label: '5 (周五)', value: '5' },
  { label: '6 (周六)', value: '6' }
]

const CronClient = () => {
  const { t } = useTranslation()
  const toast = useToast()

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
    toast.success(t('app.social.retires.copy_success'))
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="second">{t('app.generation.cron.second')}</Label>
              <Select
                id="second"
                value={formData.second}
                onChange={(e) => setFormData(prev => ({ ...prev, second: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minute">{t('app.generation.cron.minute')}</Label>
              <Select
                id="minute"
                value={formData.minute}
                onChange={(e) => setFormData(prev => ({ ...prev, minute: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hour">{t('app.generation.cron.hour')}</Label>
              <Select
                id="hour"
                value={formData.hour}
                onChange={(e) => setFormData(prev => ({ ...prev, hour: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">{t('app.generation.cron.day')}</Label>
              <Select
                id="dayOfMonth"
                value={formData.dayOfMonth}
                onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">{t('app.generation.cron.month')}</Label>
              <Select
                id="month"
                value={formData.month}
                onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value }))}
              >
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">{t('app.generation.cron.weekday')}</Label>
              <Select
                id="dayOfWeek"
                value={formData.dayOfWeek}
                onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: e.target.value }))}
              >
                {weekdayOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
              {t('app.generation.uuid.copy')}
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
          <Input
            value={cronExpression}
            readOnly
            className="font-mono text-lg text-center"
          />
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>{t('app.generation.cron.next')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {nextExecutions.length > 0 ? (
              nextExecutions.map((time, index) => (
                <code key={index} className="text-sm text-[var(--text-primary)]">
                  {index + 1}. {time}
                </code>
              ))
            ) : (
              <span className="text-sm text-[var(--text-secondary)]">{t('app.generation.cron.invalid')}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CronClient
