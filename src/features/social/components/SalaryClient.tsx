'use client'

import { BriefcaseBusiness, Calculator, Copy, Info, RotateCcw, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

import { getRegionLabel, housingFundCityOptionMap, housingFundCityOptions } from '../data/regions'
import { calculateSalaryEstimate, type SalaryContributionRates } from '../utils'
import { formatDecimal, formatMoney, formatPercent } from '../utils/formatters'

const defaultRates: Record<keyof SalaryContributionRates, string> = {
  pensionEmployee: '8',
  pensionEmployer: '16',
  medicalEmployee: '2',
  medicalEmployer: '9',
  unemploymentEmployee: '0.5',
  unemploymentEmployer: '0.5',
  injuryEmployer: '0.2',
  maternityEmployer: '0',
  housingFundEmployee: '12',
  housingFundEmployer: '12'
}

const parseAmount = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

const SalaryClient = () => {
  const { i18n, t } = useTranslation()
  const { copy } = useCopy()

  const [city, setCity] = useState('custom')
  const [customCity, setCustomCity] = useState('')
  const [grossSalary, setGrossSalary] = useState('15000')
  const [socialBase, setSocialBase] = useState('15000')
  const [housingFundBase, setHousingFundBase] = useState('15000')
  const [specialDeductions, setSpecialDeductions] = useState('0')
  const [rates, setRates] = useState(defaultRates)

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
  const grossSalaryValue = parseAmount(grossSalary)

  const rateValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rates).map(([key, value]) => [key, parseAmount(value)])
      ) as unknown as SalaryContributionRates,
    [rates]
  )

  const result = useMemo(
    () =>
      calculateSalaryEstimate({
        grossSalary: grossSalaryValue,
        housingFundBase: parseAmount(housingFundBase),
        rates: rateValues,
        socialBase: parseAmount(socialBase),
        specialDeductions: parseAmount(specialDeductions)
      }),
    [grossSalaryValue, housingFundBase, rateValues, socialBase, specialDeductions]
  )

  const insight = useMemo(() => {
    const takeHomeRate = grossSalaryValue > 0 ? (result.netSalary / grossSalaryValue) * 100 : 0
    const employerCostMultiple =
      grossSalaryValue > 0 ? result.employerTotalCost / grossSalaryValue : 0
    const employerContributionShare =
      result.employerTotalCost > 0
        ? (result.employerContributions / result.employerTotalCost) * 100
        : 0

    return {
      employerContributionShare,
      employerCostMultiple,
      takeHomeRate
    }
  }, [grossSalaryValue, result])

  const formatted = useMemo(
    () => ({
      annualNetSalary: formatMoney(result.annualNetSalary, language),
      annualTax: formatMoney(result.annualTax, language),
      employeeDeductions: formatMoney(result.employeeDeductions, language),
      employeeHousingFund: formatMoney(result.employeeHousingFund, language),
      employeeSocial: formatMoney(result.employeeSocial, language),
      employerContributionShare: formatPercent(insight.employerContributionShare, language),
      employerContributions: formatMoney(result.employerContributions, language),
      employerCostMultiple: t('app.social.salary.multiplier_value', {
        value: formatDecimal(insight.employerCostMultiple, language)
      }),
      employerTotalCost: formatMoney(result.employerTotalCost, language),
      monthlyTax: formatMoney(result.monthlyTax, language),
      netSalary: formatMoney(result.netSalary, language),
      takeHomeRate: formatPercent(insight.takeHomeRate, language),
      taxableMonthlyIncome: formatMoney(result.taxableMonthlyIncome, language)
    }),
    [insight, language, result, t]
  )

  const updateRate = (key: keyof SalaryContributionRates, value: string) => {
    setRates(current => ({ ...current, [key]: value }))
  }

  const reset = () => {
    setCity('custom')
    setCustomCity('')
    setGrossSalary('15000')
    setSocialBase('15000')
    setHousingFundBase('15000')
    setSpecialDeductions('0')
    setRates(defaultRates)
  }

  const syncBases = () => {
    setSocialBase(grossSalary)
    setHousingFundBase(grossSalary)
  }

  const summary = useMemo(
    () =>
      [
        `${t('app.social.region.jurisdiction')}: ${cityLabel}`,
        `${t('app.social.salary.net_salary')}: ${formatted.netSalary}`,
        `${t('app.social.salary.monthly_tax')}: ${formatted.monthlyTax}`,
        `${t('app.social.salary.employee_deductions')}: ${formatted.employeeDeductions}`,
        `${t('app.social.salary.employer_total_cost')}: ${formatted.employerTotalCost}`,
        `${t('app.social.salary.take_home_rate')}: ${formatted.takeHomeRate}`,
        `${t('app.social.salary.employer_cost_multiple')}: ${formatted.employerCostMultiple}`
      ].join('\n'),
    [cityLabel, formatted, t]
  )

  return (
    <div className="grid size-full min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-[var(--primary)]" />
                {t('app.social.salary')}
              </CardTitle>
              <CardDescription>{t('app.social.salary.description')}</CardDescription>
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
                  {t('app.social.salary.region_hint')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="salary-city" label={t('app.social.region.city')}>
                <Select value={city} onChange={event => setCity(event.target.value)}>
                  {citySelectOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {city === 'custom' && (
                <Field id="salary-custom-city" label={t('app.social.region.custom_city_name')}>
                  <Input
                    id="salary-custom-city"
                    value={customCity}
                    onChange={event => setCustomCity(event.target.value)}
                    placeholder={t('app.social.region.city_placeholder')}
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="salary-gross" label={t('app.social.salary.gross_salary')}>
              <Input
                id="salary-gross"
                inputMode="decimal"
                min="0"
                type="number"
                value={grossSalary}
                onChange={event => setGrossSalary(event.target.value)}
              />
            </Field>
            <Field id="salary-special" label={t('app.social.salary.special_deductions')}>
              <Input
                id="salary-special"
                inputMode="decimal"
                min="0"
                type="number"
                value={specialDeductions}
                onChange={event => setSpecialDeductions(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t('app.social.salary.base_title')}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                  {t('app.social.salary.base_hint')}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={syncBases}>
                {t('app.social.salary.sync_bases')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="salary-social-base" label={t('app.social.salary.social_base')}>
                <Input
                  id="salary-social-base"
                  inputMode="decimal"
                  min="0"
                  type="number"
                  value={socialBase}
                  onChange={event => setSocialBase(event.target.value)}
                />
              </Field>
              <Field id="salary-housing-base" label={t('app.social.salary.housing_base')}>
                <Input
                  id="salary-housing-base"
                  inputMode="decimal"
                  min="0"
                  type="number"
                  value={housingFundBase}
                  onChange={event => setHousingFundBase(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {t('app.social.salary.rate_title')}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                {t('app.social.salary.rate_hint')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rateFields.map(field => (
                <Field key={field.key} id={`salary-${field.key}`} label={t(field.label)}>
                  <Input
                    id={`salary-${field.key}`}
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    type="number"
                    value={rates[field.key]}
                    onChange={event => updateRate(field.key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[var(--primary)]" />
              {t('app.social.salary.result')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="glass-panel glass-glow-primary glass-prism rounded-2xl p-5">
              <div className="mb-3 inline-flex max-w-full rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <span className="min-w-0 truncate">{cityLabel}</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                {t('app.social.salary.net_salary')}
              </div>
              <div className="mt-3 break-words font-mono text-4xl font-semibold tabular-nums text-[var(--text-primary)]">
                {formatted.netSalary}
              </div>
              <div className="mt-2 text-sm text-[var(--text-tertiary)]">
                {t('app.social.salary.annual_net_value', {
                  amount: formatted.annualNetSalary
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label={t('app.social.salary.take_home_rate')}
                value={formatted.takeHomeRate}
              />
              <MetricCard
                label={t('app.social.salary.employer_cost_multiple')}
                value={formatted.employerCostMultiple}
              />
              <MetricCard
                label={t('app.social.salary.employer_contribution_share')}
                value={formatted.employerContributionShare}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard label={t('app.social.salary.monthly_tax')} value={formatted.monthlyTax} />
              <MetricCard
                label={t('app.social.salary.employee_deductions')}
                value={formatted.employeeDeductions}
              />
              <MetricCard
                label={t('app.social.salary.employer_total_cost')}
                value={formatted.employerTotalCost}
              />
              <MetricCard
                label={t('app.social.salary.employer_contributions')}
                value={formatted.employerContributions}
              />
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4">
              <div className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0">
                  <BreakdownRow
                    label={t('app.social.salary.employee_social')}
                    value={formatted.employeeSocial}
                  />
                  <BreakdownRow
                    label={t('app.social.salary.employee_housing')}
                    value={formatted.employeeHousingFund}
                  />
                  <BreakdownRow
                    label={t('app.social.salary.taxable_income')}
                    value={formatted.taxableMonthlyIncome}
                  />
                  <BreakdownRow
                    label={t('app.social.salary.annual_tax')}
                    value={formatted.annualTax}
                  />
                </div>
              </div>
            </div>

            <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-4 py-3 text-xs leading-5 text-[var(--text-tertiary)]">
              {t('app.social.salary.disclaimer')}
            </p>

            <Button
              type="button"
              icon={<Copy className="h-4 w-4" />}
              className="w-full sm:w-fit"
              onClick={() => copy(summary)}
            >
              {t('app.social.salary.copy')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const rateFields: Array<{ key: keyof SalaryContributionRates; label: string }> = [
  { key: 'pensionEmployee', label: 'app.social.salary.pension_employee' },
  { key: 'pensionEmployer', label: 'app.social.salary.pension_employer' },
  { key: 'medicalEmployee', label: 'app.social.salary.medical_employee' },
  { key: 'medicalEmployer', label: 'app.social.salary.medical_employer' },
  { key: 'unemploymentEmployee', label: 'app.social.salary.unemployment_employee' },
  { key: 'unemploymentEmployer', label: 'app.social.salary.unemployment_employer' },
  { key: 'injuryEmployer', label: 'app.social.salary.injury_employer' },
  { key: 'maternityEmployer', label: 'app.social.salary.maternity_employer' },
  { key: 'housingFundEmployee', label: 'app.social.salary.housing_employee' },
  { key: 'housingFundEmployer', label: 'app.social.salary.housing_employer' }
]

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

const BreakdownRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2 last:border-b-0">
    <span className="min-w-0 text-[var(--text-tertiary)]">{label}</span>
    <span className="shrink-0 font-mono font-medium text-[var(--text-primary)]">{value}</span>
  </div>
)

export default SalaryClient
