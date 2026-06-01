'use client'

import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import { calcRetires, type calcRetiresParams, type calcRetiresReturnType } from '../utils'

const RetiresClient = () => {
  const { i18n, t } = useTranslation()

  const [birth, setBirth] = useState<Date>()
  const [gender, setGender] = useState<'male' | 'female'>()
  const [occupation, setOccupation] = useState<'worker' | 'staff'>()

  const [retirement, setRetirement] = useState<calcRetiresReturnType>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!birth || !gender) return
    if (gender === 'female' && !occupation) return

    const params: calcRetiresParams = {
      birth,
      gender,
      ...(gender === 'female' && occupation ? { occupation } : {})
    }
    setRetirement(calcRetires(params))
  }

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
    const dateStr =
      i18n.language === 'cn'
        ? dayjs(retirement.retirementDate).format('YYYY年MM月DD日')
        : dayjs(retirement.retirementDate).format('MMMM D, YYYY')
    const monthPart =
      retirement.newRetirementPolicy && retirement.baseRetirementMonth
        ? t('app.social.retires.summary.months', {
            months: retirement.baseRetirementMonth
          })
        : ''

    if (retirement.newRetirementPolicy) {
      return t('app.social.retires.summary', {
        age: retirement.baseRetirementAge,
        date: dateStr,
        monthPart
      })
    }

    return t('app.social.retires.summary', {
      age: retirement.baseRetirementAge,
      date: dateStr,
      monthPart: ''
    })
  }, [i18n.language, retirement, t])

  return (
    <>
      <div className="flex justify-center">
        <Card className="w-full max-w-[700px]">
          <CardHeader>
            <CardTitle>{t('app.social.retires')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                <Label className="sm:pt-3.5">{t('app.social.retires.birthday')}</Label>
                <DatePicker
                  value={birth}
                  onChange={setBirth}
                  placeholder={t('app.social.retires.birthday')}
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                <Label className="sm:pt-3.5">{t('app.social.retires.gender')}</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={v => setGender(v as 'male' | 'female')}
                  className="gap-3 sm:pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="cursor-pointer">
                      {t('app.social.retires.male')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="cursor-pointer">
                      {t('app.social.retires.female')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {gender === 'female' && (
                <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                  <Label className="sm:pt-3.5">{t('app.social.retires.occupation')}</Label>
                  <RadioGroup
                    value={occupation}
                    onValueChange={v => setOccupation(v as 'worker' | 'staff')}
                    className="gap-3 sm:pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="worker" id="worker" />
                      <Label htmlFor="worker" className="cursor-pointer">
                        {t('app.social.retires.occupation.worker')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="staff" id="staff" />
                      <Label htmlFor="staff" className="cursor-pointer">
                        {t('app.social.retires.occupation.staff')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                <div />
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  {t('public.submit')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {retirement && stats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="mt-10 flex justify-center"
          >
            <div className="w-full max-w-[700px] glass-panel rounded-3xl p-8 relative overflow-hidden glass-glow-primary glass-caustic">
              <div className="glass-specular" />

              <div className="text-center">
                <h4 className="text-lg font-medium text-[var(--text-secondary)] mb-2">
                  {t('app.social.retires.target')}
                </h4>
                <div className="text-5xl font-extrabold text-[var(--primary)] my-4">
                  {stats.retireDateStr}
                </div>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {retirement.newRetirementPolicy
                    ? t('app.social.retires.policy.new')
                    : t('app.social.retires.policy.std')}
                </p>
              </div>

              <div className="mt-8">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t('app.social.retires.progress')}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">{stats.percent}%</span>
                </div>
                <Progress
                  value={parseFloat(stats.percent)}
                  showInfo={false}
                  strokeColor={{
                    '0%': 'var(--primary)',
                    '100%': '#f9c61a'
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.age')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {retirement.baseRetirementAge}
                    <span className="text-sm font-normal">
                      {' '}
                      {t('app.social.retires.years_short')}{' '}
                    </span>
                    {retirement.baseRetirementMonth > 0 && (
                      <>
                        {retirement.baseRetirementMonth}
                        <span className="text-sm font-normal">
                          {' '}
                          {t('app.social.retires.months_short')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.remaining')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--success)]">
                    {stats.remainingDays.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <Button
                  variant="default"
                  shape="pill"
                  size="lg"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => {
                    navigator.clipboard.writeText(resultText)
                  }}
                  className="min-w-[200px]"
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
