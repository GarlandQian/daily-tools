import dayjs from 'dayjs'

const RETIREMENT_POLICY_START = dayjs('2025-01-01')

const retirementProfiles = {
  male: {
    baseAge: 60,
    delayStepMonths: 4,
    maxDelayMonths: 36
  },
  femaleWorker: {
    baseAge: 50,
    delayStepMonths: 2,
    maxDelayMonths: 60
  },
  femaleStaff: {
    baseAge: 55,
    delayStepMonths: 4,
    maxDelayMonths: 36
  }
} as const

export const pensionAccountMonthTable: Record<number, number> = {
  40: 233,
  41: 230,
  42: 226,
  43: 223,
  44: 220,
  45: 216,
  46: 212,
  47: 208,
  48: 204,
  49: 199,
  50: 195,
  51: 190,
  52: 185,
  53: 180,
  54: 175,
  55: 170,
  56: 164,
  57: 158,
  58: 152,
  59: 145,
  60: 139,
  61: 132,
  62: 125,
  63: 117,
  64: 109,
  65: 101,
  66: 93,
  67: 84,
  68: 75,
  69: 65,
  70: 56
}

export interface calcRetiresParams {
  /** 生日 */
  birth: Date
  /** 性别 */
  gender: 'male' | 'female'
  /** 女性区分 worker/staff */
  occupation?: 'worker' | 'staff'
}

export interface calcRetiresReturnType {
  /** 是否享受新政策 */
  newRetirementPolicy: boolean
  /** 退休年月日 */
  retirementDate: Date
  /** 原法定退休年月日 */
  standardRetirementDate: Date
  /** 延迟月数 */
  delayMonths: number
  /** 退休年龄 */
  baseRetirementAge: number
  /** 退休月年龄 */
  baseRetirementMonth: number
  /** 原法定退休年龄 */
  standardRetirementAge: number
}

export interface PensionEstimateParams {
  localAverageSalary: number
  averageContributionIndex: number
  contributionYears: number
  personalAccountBalance: number
  retirementAge: number
  preRetirementSalary?: number
}

export interface PensionEstimateResult {
  indexedAverageSalary: number
  basicPension: number
  personalAccountPension: number
  accountMonths: number
  monthlyTotal: number
  annualTotal: number
  replacementRate: number | null
}

export interface HousingFundEstimateParams {
  monthlyBase: number
  employeeRate: number
  employerRate: number
  months: number
  currentBalance: number
  annualInterestRate: number
}

export interface HousingFundEstimateResult {
  employeeMonthly: number
  employerMonthly: number
  monthlyTotal: number
  annualTotal: number
  employeeTotal: number
  employerTotal: number
  interestIncome: number
  projectedBalance: number
}

export interface SalaryContributionRates {
  pensionEmployee: number
  pensionEmployer: number
  medicalEmployee: number
  medicalEmployer: number
  unemploymentEmployee: number
  unemploymentEmployer: number
  injuryEmployer: number
  maternityEmployer: number
  housingFundEmployee: number
  housingFundEmployer: number
}

export interface SalaryEstimateParams {
  grossSalary: number
  socialBase: number
  housingFundBase: number
  specialDeductions: number
  rates: SalaryContributionRates
}

export interface SalaryEstimateResult {
  employeeSocial: number
  employeeHousingFund: number
  employeeDeductions: number
  employerSocial: number
  employerHousingFund: number
  employerContributions: number
  taxableMonthlyIncome: number
  annualTaxableIncome: number
  monthlyTax: number
  annualTax: number
  netSalary: number
  annualNetSalary: number
  employerTotalCost: number
  totalBenefitCost: number
}

const getRetirementProfile = (
  gender: calcRetiresParams['gender'],
  occupation?: 'worker' | 'staff'
) => {
  if (gender === 'male') return retirementProfiles.male
  if (gender === 'female' && occupation === 'worker') return retirementProfiles.femaleWorker
  if (gender === 'female' && occupation === 'staff') return retirementProfiles.femaleStaff
  throw new Error('Invalid gender or occupation')
}

const getDelayMonths = (
  standardRetirementDate: dayjs.Dayjs,
  profile: (typeof retirementProfiles)[keyof typeof retirementProfiles]
) => {
  if (standardRetirementDate.isBefore(RETIREMENT_POLICY_START, 'day')) return 0

  const monthsAfterStart = Math.max(
    0,
    standardRetirementDate.diff(RETIREMENT_POLICY_START, 'month')
  )
  const delayMonths = Math.floor(monthsAfterStart / profile.delayStepMonths) + 1

  return Math.min(delayMonths, profile.maxDelayMonths)
}

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100

const annualTaxBrackets = [
  { cap: 36000, rate: 0.03, quickDeduction: 0 },
  { cap: 144000, rate: 0.1, quickDeduction: 2520 },
  { cap: 300000, rate: 0.2, quickDeduction: 16920 },
  { cap: 420000, rate: 0.25, quickDeduction: 31920 },
  { cap: 660000, rate: 0.3, quickDeduction: 52920 },
  { cap: 960000, rate: 0.35, quickDeduction: 85920 },
  { cap: Number.POSITIVE_INFINITY, rate: 0.45, quickDeduction: 181920 }
] as const

const calculateAnnualIncomeTax = (annualTaxableIncome: number) => {
  const safeTaxableIncome = Math.max(0, annualTaxableIncome)
  const bracket =
    annualTaxBrackets.find(item => safeTaxableIncome <= item.cap) ?? annualTaxBrackets[0]

  return Math.max(0, safeTaxableIncome * bracket.rate - bracket.quickDeduction)
}

const estimateAnnualSettlementBalance = ({
  annualInterestRate,
  currentBalance,
  monthlyTotal,
  months
}: {
  annualInterestRate: number
  currentBalance: number
  monthlyTotal: number
  months: number
}) => {
  const monthlySimpleRate = Math.max(0, annualInterestRate) / 100 / 12
  const startingBalance = Math.max(0, currentBalance)
  const fullYears = Math.floor(months / 12)
  const remainingMonths = months % 12

  let settledBalance = startingBalance

  if (fullYears > 0) {
    if (monthlySimpleRate === 0) {
      settledBalance += monthlyTotal * fullYears * 12
    } else {
      const annualGrowth = 1 + monthlySimpleRate * 12
      const annualContribution = monthlyTotal * (12 + monthlySimpleRate * 66)
      const growthPower = Math.pow(annualGrowth, fullYears)

      settledBalance =
        startingBalance * growthPower +
        (annualContribution * (growthPower - 1)) / (annualGrowth - 1)
    }
  }

  const remainingInterest =
    monthlySimpleRate *
    (remainingMonths * settledBalance +
      monthlyTotal * ((remainingMonths * (remainingMonths - 1)) / 2))

  return settledBalance + monthlyTotal * remainingMonths + remainingInterest
}

export const calcRetires = ({
  birth,
  gender,
  occupation
}: calcRetiresParams): calcRetiresReturnType => {
  const birthDay = dayjs(birth)
  const profile = getRetirementProfile(gender, occupation)
  const standardRetirementDate = birthDay.add(profile.baseAge * 12, 'month')
  const delayMonths = getDelayMonths(standardRetirementDate, profile)
  const retirementAgeInMonths = profile.baseAge * 12 + delayMonths
  const retireDate = birthDay.add(retirementAgeInMonths, 'M')

  const finalAge = Math.floor(retirementAgeInMonths / 12)
  const finalMonths = retirementAgeInMonths % 12

  return {
    newRetirementPolicy: delayMonths > 0,
    retirementDate: retireDate.toDate(),
    standardRetirementDate: standardRetirementDate.toDate(),
    delayMonths,
    baseRetirementAge: finalAge,
    baseRetirementMonth: finalMonths,
    standardRetirementAge: profile.baseAge
  }
}

export const calculatePensionEstimate = ({
  localAverageSalary,
  averageContributionIndex,
  contributionYears,
  personalAccountBalance,
  retirementAge,
  preRetirementSalary
}: PensionEstimateParams): PensionEstimateResult => {
  const normalizedAge = Math.min(70, Math.max(40, Math.round(retirementAge)))
  const accountMonths = pensionAccountMonthTable[normalizedAge] ?? pensionAccountMonthTable[60]
  const indexedAverageSalary = localAverageSalary * averageContributionIndex
  const basicPension = ((localAverageSalary + indexedAverageSalary) / 2) * contributionYears * 0.01
  const personalAccountPension = personalAccountBalance / accountMonths
  const monthlyTotal = basicPension + personalAccountPension
  const replacementRate =
    preRetirementSalary && preRetirementSalary > 0
      ? (monthlyTotal / preRetirementSalary) * 100
      : null

  return {
    indexedAverageSalary: roundMoney(indexedAverageSalary),
    basicPension: roundMoney(basicPension),
    personalAccountPension: roundMoney(personalAccountPension),
    accountMonths,
    monthlyTotal: roundMoney(monthlyTotal),
    annualTotal: roundMoney(monthlyTotal * 12),
    replacementRate: replacementRate === null ? null : roundMoney(replacementRate)
  }
}

export const calculateHousingFundEstimate = ({
  monthlyBase,
  employeeRate,
  employerRate,
  months,
  currentBalance,
  annualInterestRate
}: HousingFundEstimateParams): HousingFundEstimateResult => {
  const safeMonths = Math.max(0, Math.floor(months))
  const employeeMonthly = monthlyBase * (employeeRate / 100)
  const employerMonthly = monthlyBase * (employerRate / 100)
  const monthlyTotal = employeeMonthly + employerMonthly
  const projectedBalance = estimateAnnualSettlementBalance({
    annualInterestRate,
    currentBalance,
    monthlyTotal,
    months: safeMonths
  })

  const employeeTotal = employeeMonthly * safeMonths
  const employerTotal = employerMonthly * safeMonths
  const totalContribution = employeeTotal + employerTotal
  const interestIncome = projectedBalance - Math.max(0, currentBalance) - totalContribution

  return {
    employeeMonthly: roundMoney(employeeMonthly),
    employerMonthly: roundMoney(employerMonthly),
    monthlyTotal: roundMoney(monthlyTotal),
    annualTotal: roundMoney(monthlyTotal * 12),
    employeeTotal: roundMoney(employeeTotal),
    employerTotal: roundMoney(employerTotal),
    interestIncome: roundMoney(Math.max(0, interestIncome)),
    projectedBalance: roundMoney(projectedBalance)
  }
}

export const calculateSalaryEstimate = ({
  grossSalary,
  socialBase,
  housingFundBase,
  specialDeductions,
  rates
}: SalaryEstimateParams): SalaryEstimateResult => {
  const safeGrossSalary = Math.max(0, grossSalary)
  const safeSocialBase = Math.max(0, socialBase)
  const safeHousingFundBase = Math.max(0, housingFundBase)
  const safeSpecialDeductions = Math.max(0, specialDeductions)

  const employeeSocial =
    safeSocialBase *
    ((rates.pensionEmployee + rates.medicalEmployee + rates.unemploymentEmployee) / 100)
  const employerSocial =
    safeSocialBase *
    ((rates.pensionEmployer +
      rates.medicalEmployer +
      rates.unemploymentEmployer +
      rates.injuryEmployer +
      rates.maternityEmployer) /
      100)
  const employeeHousingFund = safeHousingFundBase * (rates.housingFundEmployee / 100)
  const employerHousingFund = safeHousingFundBase * (rates.housingFundEmployer / 100)
  const employeeDeductions = employeeSocial + employeeHousingFund
  const employerContributions = employerSocial + employerHousingFund
  const taxableMonthlyIncome = Math.max(
    0,
    safeGrossSalary - employeeDeductions - safeSpecialDeductions - 5000
  )
  const annualTaxableIncome = taxableMonthlyIncome * 12
  const annualTax = calculateAnnualIncomeTax(annualTaxableIncome)
  const monthlyTax = annualTax / 12
  const netSalary = safeGrossSalary - employeeDeductions - monthlyTax

  return {
    employeeSocial: roundMoney(employeeSocial),
    employeeHousingFund: roundMoney(employeeHousingFund),
    employeeDeductions: roundMoney(employeeDeductions),
    employerSocial: roundMoney(employerSocial),
    employerHousingFund: roundMoney(employerHousingFund),
    employerContributions: roundMoney(employerContributions),
    taxableMonthlyIncome: roundMoney(taxableMonthlyIncome),
    annualTaxableIncome: roundMoney(annualTaxableIncome),
    monthlyTax: roundMoney(monthlyTax),
    annualTax: roundMoney(annualTax),
    netSalary: roundMoney(netSalary),
    annualNetSalary: roundMoney(netSalary * 12),
    employerTotalCost: roundMoney(safeGrossSalary + employerContributions),
    totalBenefitCost: roundMoney(employeeDeductions + employerContributions)
  }
}
