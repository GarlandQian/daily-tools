import dayjs from 'dayjs'

export interface calcRetiresParams {
  /** 生日 */
  birth: Date
  /** 性别 */
  gender: 'male' | 'female'
  /** 女性区分 worker/staff */
  occupation?: 'worker' | 'staff'
}

export const calcRetires = ({ birth, gender, occupation }: calcRetiresParams) => {
  // 新政策开始时间
  const startCalcDay = dayjs('2025-01-01')
  // 生日
  const birthDay = dayjs(birth)

  // 计算退休的基础年龄
  let baseRetirementAge: number
  // 计算延迟幅度
  let delayMonths = 0

  if (gender === 'male') {
    baseRetirementAge = 60
  } else if (gender === 'female' && occupation === 'worker') {
    baseRetirementAge = 50
  } else if (gender === 'female' && occupation === 'staff') {
    baseRetirementAge = 55
  } else {
    return '请输入正确的性别和职业'
  }

  const tryretiredate = dayjs(birthDay).add(baseRetirementAge * 12, 'M')

  // 判断是否在2025年1月1日之前可以退休
  if (tryretiredate.isBefore(startCalcDay)) {
    // 在2025年前退休，使用旧政策
    return {
      retirementDate: tryretiredate.format('YYYY年MM月DD日'),
      baseRetirementAge: `${baseRetirementAge}岁`,
    }
  }

  // 如果在2025年后退休，计算延迟幅度
  const yearsUntil2025 = startCalcDay.year() - birthDay.year() + 60
  if (gender === 'male') {
    delayMonths = Math.floor((yearsUntil2025 * 12) / 4) // 男性每4个月延迟1个月
    if (baseRetirementAge + delayMonths / 12 > 63) {
      delayMonths = (63 - baseRetirementAge) * 12 // 最多延迟到63岁
    }
  } else if (gender === 'female' && occupation === 'worker') {
    delayMonths = Math.floor((yearsUntil2025 * 12) / 2) // 女性工人每2个月延迟1个月
    if (baseRetirementAge + delayMonths / 12 > 55) {
      delayMonths = (55 - baseRetirementAge) * 12 // 最多延迟到55岁
    }
  } else if (gender === 'female' && occupation === 'staff') {
    delayMonths = Math.floor((yearsUntil2025 * 12) / 4) // 女性职员每4个月延迟1个月
    if (baseRetirementAge + delayMonths / 12 > 58) {
      delayMonths = (58 - baseRetirementAge) * 12 // 最多延迟到58岁
    }
  }

  // 最终退休年龄（以月为单位）
  const retirementAgeInMonths = baseRetirementAge * 12 + delayMonths
  const retireDate = birthDay.add(retirementAgeInMonths, 'M')

  const finalAge = Math.floor(retirementAgeInMonths / 12)
  const finalMonths = retirementAgeInMonths % 12

  return {
    retirementDate: retireDate.format('YYYY年MM月DD日'),
    baseRetirementAge: `${finalAge}岁${finalMonths}个月`,
  }
}
