'use client'

import { Calculator, Copy, Info, RotateCcw, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

import { getRegionLabel, pensionProvinceOptionMap, pensionProvinceOptions } from '../data/regions'
import { calculatePensionEstimate, pensionAccountMonthTable } from '../utils'
import { formatMoney } from '../utils/formatters'

const parseAmount = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

const ageOptions = Object.keys(pensionAccountMonthTable).map(Number)

const PensionClient = () => {
  const { i18n, t } = useTranslation()
  const { copy } = useCopy()

  const [province, setProvince] = useState('custom')
  const [benefitCity, setBenefitCity] = useState('')
  const [localAverageSalary, setLocalAverageSalary] = useState('12000')
  const [averageContributionIndex, setAverageContributionIndex] = useState('1')
  const [contributionYears, setContributionYears] = useState('30')
  const [personalAccountBalance, setPersonalAccountBalance] = useState('180000')
  const [retirementAge, setRetirementAge] = useState('60')
  const [preRetirementSalary, setPreRetirementSalary] = useState('12000')

  const language = i18n.language
  const selectedProvince = pensionProvinceOptionMap.get(province)
  const provinceSelectOptions = useMemo(
    () =>
      pensionProvinceOptions.map(option => ({
        label: getRegionLabel(option, language),
        value: option.value
      })),
    [language]
  )

  const result = useMemo(
    () =>
      calculatePensionEstimate({
        averageContributionIndex: parseAmount(averageContributionIndex),
        contributionYears: parseAmount(contributionYears),
        localAverageSalary: parseAmount(localAverageSalary),
        personalAccountBalance: parseAmount(personalAccountBalance),
        preRetirementSalary: parseAmount(preRetirementSalary),
        retirementAge: parseAmount(retirementAge)
      }),
    [
      averageContributionIndex,
      contributionYears,
      localAverageSalary,
      personalAccountBalance,
      preRetirementSalary,
      retirementAge
    ]
  )

  const benefitPlace = benefitCity.trim()
  const regionLabel = useMemo(() => {
    const provinceLabel = getRegionLabel(selectedProvince, language)

    if (province === 'custom') return benefitPlace || t('app.social.region.custom')
    if (benefitPlace) {
      return t('app.social.region.province_city', { city: benefitPlace, province: provinceLabel })
    }

    return provinceLabel
  }, [benefitPlace, language, province, selectedProvince, t])

  const formatted = useMemo(
    () => ({
      annualTotal: formatMoney(result.annualTotal, language),
      basicPension: formatMoney(result.basicPension, language),
      indexedAverageSalary: formatMoney(result.indexedAverageSalary, language),
      monthlyTotal: formatMoney(result.monthlyTotal, language),
      personalAccountPension: formatMoney(result.personalAccountPension, language)
    }),
    [language, result]
  )

  const reset = () => {
    setProvince('custom')
    setBenefitCity('')
    setLocalAverageSalary('12000')
    setAverageContributionIndex('1')
    setContributionYears('30')
    setPersonalAccountBalance('180000')
    setRetirementAge('60')
    setPreRetirementSalary('12000')
  }

  const summary = useMemo(
    () =>
      [
        `${t('app.social.region.jurisdiction')}: ${regionLabel}`,
        `${t('app.social.pension.monthly_total')}: ${formatted.monthlyTotal}`,
        `${t('app.social.pension.basic_pension')}: ${formatted.basicPension}`,
        `${t('app.social.pension.personal_account_pension')}: ${formatted.personalAccountPension}`,
        `${t('app.social.pension.account_months')}: ${result.accountMonths}`
      ].join('\n'),
    [formatted, regionLabel, result.accountMonths, t]
  )

  return (
    <div className="grid size-full min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-[var(--primary)]" />
                {t('app.social.pension')}
              </CardTitle>
              <CardDescription>{t('app.social.pension.description')}</CardDescription>
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
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t('app.social.region.jurisdiction')}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                  {t('app.social.pension.region_hint')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="pension-province" label={t('app.social.region.province')}>
                <Select value={province} onChange={event => setProvince(event.target.value)}>
                  {provinceSelectOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                description={t('app.social.pension.benefit_city_hint')}
                id="pension-benefit-city"
                label={t('app.social.region.benefit_city')}
              >
                <Input
                  id="pension-benefit-city"
                  value={benefitCity}
                  onChange={event => setBenefitCity(event.target.value)}
                  placeholder={t('app.social.region.city_placeholder')}
                />
              </Field>
            </div>
          </div>

          <Field
            description={t('app.social.pension.avg_salary_hint_with_region', {
              region: regionLabel
            })}
            id="pension-local-average-salary"
            label={t('app.social.pension.avg_salary')}
          >
            <Input
              id="pension-local-average-salary"
              inputMode="decimal"
              type="number"
              min="0"
              value={localAverageSalary}
              onChange={event => setLocalAverageSalary(event.target.value)}
            />
          </Field>

          <Field
            description={t('app.social.pension.index_hint')}
            id="pension-index"
            label={t('app.social.pension.index')}
          >
            <Input
              id="pension-index"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={averageContributionIndex}
              onChange={event => setAverageContributionIndex(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="pension-years" label={t('app.social.pension.years')}>
              <Input
                id="pension-years"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.5"
                value={contributionYears}
                onChange={event => setContributionYears(event.target.value)}
              />
            </Field>

            <Field id="pension-age" label={t('app.social.pension.retirement_age')}>
              <Select
                value={retirementAge}
                onChange={event => setRetirementAge(event.target.value)}
              >
                {ageOptions.map(age => (
                  <option key={age} value={age}>
                    {t('app.social.pension.age_option', {
                      age,
                      months: pensionAccountMonthTable[age]
                    })}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field id="pension-account-balance" label={t('app.social.pension.account_balance')}>
            <Input
              id="pension-account-balance"
              inputMode="decimal"
              type="number"
              min="0"
              value={personalAccountBalance}
              onChange={event => setPersonalAccountBalance(event.target.value)}
            />
          </Field>

          <Field
            description={t('app.social.pension.final_salary_hint')}
            id="pension-final-salary"
            label={t('app.social.pension.final_salary')}
          >
            <Input
              id="pension-final-salary"
              inputMode="decimal"
              type="number"
              min="0"
              value={preRetirementSalary}
              onChange={event => setPreRetirementSalary(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[var(--primary)]" />
              {t('app.social.pension.result')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="glass-panel glass-glow-primary glass-prism rounded-2xl p-5">
              <div className="mb-3 inline-flex max-w-full rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <span className="min-w-0 truncate">{regionLabel}</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                {t('app.social.pension.monthly_total')}
              </div>
              <div className="mt-3 break-words font-mono text-4xl font-semibold tabular-nums text-[var(--text-primary)]">
                {formatted.monthlyTotal}
              </div>
              <div className="mt-2 text-sm text-[var(--text-tertiary)]">
                {t('app.social.pension.annual_total_value', {
                  amount: formatted.annualTotal
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                label={t('app.social.pension.basic_pension')}
                value={formatted.basicPension}
              />
              <MetricCard
                label={t('app.social.pension.personal_account_pension')}
                value={formatted.personalAccountPension}
              />
              <MetricCard
                label={t('app.social.pension.indexed_salary')}
                value={formatted.indexedAverageSalary}
              />
              <MetricCard
                label={t('app.social.pension.account_months')}
                value={String(result.accountMonths)}
              />
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 text-sm leading-6 text-[var(--text-secondary)]">
                  <p>{t('app.social.pension.formula_basic')}</p>
                  <p>{t('app.social.pension.formula_account')}</p>
                  {result.replacementRate !== null && (
                    <p>
                      {t('app.social.pension.replacement_rate', {
                        rate: result.replacementRate
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="button"
              icon={<Copy className="h-4 w-4" />}
              className="w-full sm:w-fit"
              onClick={() => copy(summary)}
            >
              {t('app.social.pension.copy')}
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

export default PensionClient
