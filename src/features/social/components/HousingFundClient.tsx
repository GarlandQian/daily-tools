'use client'

import { Building2, Copy, Landmark, RotateCcw, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

import { getRegionLabel, housingFundCityOptionMap, housingFundCityOptions } from '../data/regions'
import { calculateHousingFundEstimate } from '../utils'
import { formatMoney } from '../utils/formatters'

const parseAmount = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

const commonRatePresets = ['5', '7', '10', '12'] as const
const TEXT_FIELD_LIMIT = 80
const NUMBER_FIELD_LIMIT = 24

const HousingFundClient = () => {
  const { i18n, t } = useTranslation()
  const { copy } = useCopy()

  const [city, setCity] = useState('custom')
  const [customCity, setCustomCity] = useState('')
  const [monthlyBase, setMonthlyBase] = useState('12000')
  const [employeeRate, setEmployeeRate] = useState('12')
  const [employerRate, setEmployerRate] = useState('12')
  const [months, setMonths] = useState('36')
  const [currentBalance, setCurrentBalance] = useState('20000')
  const [annualInterestRate, setAnnualInterestRate] = useState('1.5')

  const language = i18n.language
  const selectedCity = housingFundCityOptionMap.get(city)
  const citySelectOptions = useMemo(
    () =>
      housingFundCityOptions.map(option => ({
        label: getRegionLabel(option, language),
        value: option.value
      })),
    [language]
  )
  const cityLabel = useMemo(
    () =>
      city === 'custom'
        ? customCity.trim() || t('app.social.region.custom_city')
        : getRegionLabel(selectedCity, language),
    [city, customCity, language, selectedCity, t]
  )

  const result = useMemo(
    () =>
      calculateHousingFundEstimate({
        annualInterestRate: parseAmount(annualInterestRate),
        currentBalance: parseAmount(currentBalance),
        employeeRate: parseAmount(employeeRate),
        employerRate: parseAmount(employerRate),
        monthlyBase: parseAmount(monthlyBase),
        months: parseAmount(months)
      }),
    [annualInterestRate, currentBalance, employeeRate, employerRate, monthlyBase, months]
  )

  const employeeRateValue = parseAmount(employeeRate)
  const employerRateValue = parseAmount(employerRate)
  const totalRate = employeeRateValue + employerRateValue
  const recommendedRate =
    employeeRateValue >= 5 &&
    employeeRateValue <= 12 &&
    employerRateValue >= 5 &&
    employerRateValue <= 12

  const formatted = useMemo(
    () => ({
      annualTotal: formatMoney(result.annualTotal, language),
      employeeMonthly: formatMoney(result.employeeMonthly, language),
      employeeTotal: formatMoney(result.employeeTotal, language),
      employerMonthly: formatMoney(result.employerMonthly, language),
      employerTotal: formatMoney(result.employerTotal, language),
      interestIncome: formatMoney(result.interestIncome, language),
      monthlyTotal: formatMoney(result.monthlyTotal, language),
      projectedBalance: formatMoney(result.projectedBalance, language)
    }),
    [language, result]
  )

  const reset = () => {
    setCity('custom')
    setCustomCity('')
    setMonthlyBase('12000')
    setEmployeeRate('12')
    setEmployerRate('12')
    setMonths('36')
    setCurrentBalance('20000')
    setAnnualInterestRate('1.5')
  }

  const applyCommonRate = (rate: string) => {
    setEmployeeRate(rate)
    setEmployerRate(rate)
  }

  const summary = useMemo(
    () =>
      [
        `${t('app.social.region.jurisdiction')}: ${cityLabel}`,
        `${t('app.social.housing_fund.monthly_total')}: ${formatted.monthlyTotal}`,
        `${t('app.social.housing_fund.employee_monthly')}: ${formatted.employeeMonthly}`,
        `${t('app.social.housing_fund.employer_monthly')}: ${formatted.employerMonthly}`,
        `${t('app.social.housing_fund.projected_balance')}: ${formatted.projectedBalance}`
      ].join('\n'),
    [cityLabel, formatted, t]
  )

  return (
    <div className="grid size-full min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[var(--primary)]" />
                {t('app.social.housing_fund')}
              </CardTitle>
              <CardDescription>{t('app.social.housing_fund.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={reset}
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t('app.social.region.jurisdiction')}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                  {t('app.social.housing_fund.region_hint')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="housing-city" label={t('app.social.region.city')}>
                <Select value={city} onChange={event => setCity(event.target.value)}>
                  {citySelectOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {city === 'custom' && (
                <Field id="housing-custom-city" label={t('app.social.region.custom_city_name')}>
                  <Input
                    id="housing-custom-city"
                    value={customCity}
                    onChange={event => setCustomCity(event.target.value.slice(0, TEXT_FIELD_LIMIT))}
                    placeholder={t('app.social.region.city_placeholder')}
                    maxLength={TEXT_FIELD_LIMIT}
                  />
                </Field>
              )}
            </div>
          </div>

          <Field
            description={t('app.social.housing_fund.base_hint_with_city', {
              city: cityLabel
            })}
            id="housing-monthly-base"
            label={t('app.social.housing_fund.monthly_base')}
          >
            <Input
              id="housing-monthly-base"
              inputMode="decimal"
              min="0"
              type="number"
              value={monthlyBase}
              onChange={event => setMonthlyBase(event.target.value.slice(0, NUMBER_FIELD_LIMIT))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="housing-employee-rate" label={t('app.social.housing_fund.employee_rate')}>
              <Input
                id="housing-employee-rate"
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={employeeRate}
                onChange={event => setEmployeeRate(event.target.value.slice(0, NUMBER_FIELD_LIMIT))}
              />
            </Field>
            <Field id="housing-employer-rate" label={t('app.social.housing_fund.employer_rate')}>
              <Input
                id="housing-employer-rate"
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={employerRate}
                onChange={event => setEmployerRate(event.target.value.slice(0, NUMBER_FIELD_LIMIT))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-[var(--text-tertiary)]">
              {t('app.social.housing_fund.common_rates')}
            </span>
            {commonRatePresets.map(rate => {
              const isActive = employeeRate === rate && employerRate === rate

              return (
                <Button
                  key={rate}
                  type="button"
                  aria-pressed={isActive}
                  shape="pill"
                  size="sm"
                  variant={isActive ? 'primary' : 'outline'}
                  onClick={() => applyCommonRate(rate)}
                >
                  {t('app.social.housing_fund.rate_preset', { rate })}
                </Button>
              )
            })}
            <Button
              type="button"
              shape="pill"
              size="sm"
              variant="ghost"
              onClick={() => setEmployerRate(employeeRate)}
            >
              {t('app.social.housing_fund.same_as_employee')}
            </Button>
          </div>

          {!recommendedRate && (
            <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-subtle)] px-4 py-3 text-xs leading-5 text-[var(--warning)]">
              {t('app.social.housing_fund.rate_warning')}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="housing-months" label={t('app.social.housing_fund.months')}>
              <Input
                id="housing-months"
                inputMode="numeric"
                min="0"
                type="number"
                value={months}
                onChange={event => setMonths(event.target.value.slice(0, NUMBER_FIELD_LIMIT))}
              />
            </Field>
            <Field id="housing-interest" label={t('app.social.housing_fund.annual_interest')}>
              <Input
                id="housing-interest"
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={annualInterestRate}
                onChange={event =>
                  setAnnualInterestRate(event.target.value.slice(0, NUMBER_FIELD_LIMIT))
                }
              />
            </Field>
          </div>

          <Field id="housing-current-balance" label={t('app.social.housing_fund.current_balance')}>
            <Input
              id="housing-current-balance"
              inputMode="decimal"
              min="0"
              type="number"
              value={currentBalance}
              onChange={event => setCurrentBalance(event.target.value.slice(0, NUMBER_FIELD_LIMIT))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--primary)]" />
              {t('app.social.housing_fund.result')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="glass-panel glass-glow-primary glass-prism rounded-2xl p-5">
              <div className="mb-3 inline-flex max-w-full rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <span className="min-w-0 truncate">{cityLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--text-secondary)]">
                  {t('app.social.housing_fund.monthly_total')}
                </div>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  {totalRate.toFixed(1)}%
                </span>
              </div>
              <div className="mt-3 break-words font-mono text-4xl font-semibold tabular-nums text-[var(--text-primary)]">
                {formatted.monthlyTotal}
              </div>
              <div className="mt-4">
                <Progress value={Math.min(totalRate, 24)} max={24} showInfo={false} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                label={t('app.social.housing_fund.employee_monthly')}
                value={formatted.employeeMonthly}
              />
              <MetricCard
                label={t('app.social.housing_fund.employer_monthly')}
                value={formatted.employerMonthly}
              />
              <MetricCard
                label={t('app.social.housing_fund.annual_total')}
                value={formatted.annualTotal}
              />
              <MetricCard
                label={t('app.social.housing_fund.projected_balance')}
                value={formatted.projectedBalance}
              />
              <MetricCard
                label={t('app.social.housing_fund.employee_total')}
                value={formatted.employeeTotal}
              />
              <MetricCard
                label={t('app.social.housing_fund.employer_total')}
                value={formatted.employerTotal}
              />
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
              <div className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0">
                  <p>
                    {t('app.social.housing_fund.interest_income', {
                      amount: formatted.interestIncome
                    })}
                  </p>
                  <p>{t('app.social.housing_fund.disclaimer')}</p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              icon={<Copy className="h-4 w-4" />}
              className="w-full sm:w-fit"
              onClick={() => copy(summary)}
            >
              {t('app.social.housing_fund.copy')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Field = ({
  children,
  description,
  id,
  label
}: {
  children: ReactNode
  description?: string
  id: string
  label: string
}) => (
  <div className="grid gap-3">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {description && <p className="text-xs leading-5 text-[var(--text-tertiary)]">{description}</p>}
  </div>
)

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input min-w-0 rounded-xl p-4">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 break-words font-mono text-xl font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default HousingFundClient
