'use client'

import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, CalendarDays, Copy, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCopy } from '@/hooks/useCopy'

import { calcRetires, type calcRetiresParams, type calcRetiresReturnType } from '../utils'
import { formatInteger } from '../utils/formatters'

const RetiresClient = () => {
  const { i18n, t } = useTranslation()
  const { copy } = useCopy()

  const [birth, setBirth] = useState<Date>()
  const [gender, setGender] = useState<'' | 'male' | 'female'>('')
  const [occupation, setOccupation] = useState<'' | 'worker' | 'staff'>('')

  const [retirement, setRetirement] = useState<calcRetiresReturnType>()

  const clearResult = () => setRetirement(undefined)

  const reset = () => {
    setBirth(undefined)
    setGender('')
    setOccupation('')
    clearResult()
  }

  const handleBirthChange = (value: Date | undefined) => {
    setBirth(value)
    clearResult()
  }

  const handleGenderChange = (value: 'male' | 'female') => {
    setGender(value)
    setOccupation(value === 'female' ? occupation : '')
    clearResult()
  }

  const handleOccupationChange = (value: 'worker' | 'staff') => {
    setOccupation(value)
    clearResult()
  }

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
      birthDateStr: birthDay.format('YYYY-MM-DD'),
      percent: percent.toFixed(2),
      delayMonths: retirement.delayMonths,
      remainingMonths: Math.max(0, retireDay.diff(now, 'month')),
      remainingDays: remainingDays > 0 ? remainingDays : 0,
      retireYear: retireDay.year(),
      retireDateStr: retireDay.format('YYYY-MM-DD'),
      standardRetireDateStr: dayjs(retirement.standardRetirementDate).format('YYYY-MM-DD')
    }
  }, [retirement, birth])

  const retirementAgeText = useMemo(() => {
    if (!retirement) return ''

    return t('app.social.retires.age_value', {
      monthsPart:
        retirement.baseRetirementMonth > 0
          ? t('app.social.retires.age_value.months', {
              months: retirement.baseRetirementMonth
            })
          : '',
      years: retirement.baseRetirementAge
    })
  }, [retirement, t])

  const formattedStats = useMemo(() => {
    if (!stats) return null

    return {
      remainingDays: formatInteger(stats.remainingDays, i18n.language),
      remainingMonths: formatInteger(stats.remainingMonths, i18n.language)
    }
  }, [i18n.language, stats])

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

  const copyText = useMemo(() => {
    if (!retirement || !stats || !formattedStats) return resultText

    return [
      resultText,
      `${t('app.social.retires.standard_date')}: ${stats.standardRetireDateStr}`,
      `${t('app.social.retires.adjusted_date')}: ${stats.retireDateStr}`,
      `${t('app.social.retires.age')}: ${retirementAgeText}`,
      `${t('app.social.retires.delay_months')}: ${retirement.delayMonths}${t(
        'app.social.retires.months_short'
      )}`,
      `${t('app.social.retires.remaining')}: ${formattedStats.remainingDays}`
    ].join('\n')
  }, [formattedStats, resultText, retirement, retirementAgeText, stats, t])

  return (
    <>
      <div className="flex justify-center">
        <Card className="w-full max-w-[700px]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{t('app.social.retires')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
                className="w-full sm:w-auto"
              >
                {t('public.reset')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                <Label className="sm:pt-3.5">{t('app.social.retires.birthday')}</Label>
                <DatePicker
                  value={birth}
                  onChange={handleBirthChange}
                  placeholder={t('app.social.retires.birthday')}
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
                <Label className="sm:pt-3.5">{t('app.social.retires.gender')}</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={v => handleGenderChange(v as 'male' | 'female')}
                  className="gap-3 sm:pt-2"
                >
                  <div className="flex min-h-8 items-center gap-3">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="cursor-pointer">
                      {t('app.social.retires.male')}
                    </Label>
                  </div>
                  <div className="flex min-h-8 items-center gap-3">
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
                    onValueChange={v => handleOccupationChange(v as 'worker' | 'staff')}
                    className="gap-3 sm:pt-2"
                  >
                    <div className="flex min-h-8 items-center gap-3">
                      <RadioGroupItem value="worker" id="worker" />
                      <Label htmlFor="worker" className="cursor-pointer">
                        {t('app.social.retires.occupation.worker')}
                      </Label>
                    </div>
                    <div className="flex min-h-8 items-center gap-3">
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
        {retirement && stats && formattedStats && (
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
                <div className="my-4 break-words font-mono text-4xl font-extrabold leading-tight text-[var(--primary)] sm:text-5xl">
                  {stats.retireDateStr}
                </div>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {retirement.newRetirementPolicy
                    ? t('app.social.retires.policy.new')
                    : t('app.social.retires.policy.std')}
                </p>
                {retirement.delayMonths > 0 && (
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    {t('app.social.retires.delay_note', {
                      date: stats.standardRetireDateStr,
                      months: retirement.delayMonths
                    })}
                  </p>
                )}
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

              <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <CalendarClock className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                  {t('app.social.retires.timeline')}
                </div>
                <div className="mt-4 grid gap-3">
                  <TimelineRow
                    label={t('app.social.retires.birth_date')}
                    value={stats.birthDateStr}
                  />
                  <TimelineRow
                    label={t('app.social.retires.standard_date')}
                    value={stats.standardRetireDateStr}
                  />
                  <TimelineRow
                    emphasized
                    label={t('app.social.retires.adjusted_date')}
                    value={stats.retireDateStr}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.age')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {retirementAgeText}
                  </div>
                </div>
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.remaining')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--success)]">
                    {formattedStats.remainingDays}
                  </div>
                </div>
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.delay_months')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {stats.delayMonths}
                    <span className="text-sm font-normal">
                      {' '}
                      {t('app.social.retires.months_short')}
                    </span>
                  </div>
                </div>
                <div className="glass-input rounded-xl p-4 text-center">
                  <div className="text-sm text-[var(--text-secondary)] mb-1">
                    {t('app.social.retires.remaining_months')}
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">
                    {formattedStats.remainingMonths}
                    <span className="text-sm font-normal">
                      {' '}
                      {t('app.social.retires.months_short')}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3 text-xs leading-5 text-[var(--text-tertiary)]">
                {t('app.social.retires.disclaimer')}
              </p>

              <div className="mt-8 text-center">
                <Button
                  variant="default"
                  shape="pill"
                  size="lg"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => copy(copyText)}
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

const TimelineRow = ({
  emphasized = false,
  label,
  value
}: {
  emphasized?: boolean
  label: string
  value: string
}) => (
  <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2.5">
    <div className="flex min-w-0 items-center gap-2">
      <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
      <span className="truncate text-sm text-[var(--text-secondary)]">{label}</span>
    </div>
    <span
      className={`shrink-0 font-mono text-sm font-semibold ${
        emphasized ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'
      }`}
    >
      {value}
    </span>
  </div>
)

export default RetiresClient
