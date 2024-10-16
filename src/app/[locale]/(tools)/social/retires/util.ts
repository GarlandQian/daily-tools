import dayjs from 'dayjs'

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
  /** 退休年龄 */
  baseRetirementAge: number
  /** 退休月年龄 */
  baseRetirementMonth: number
}

export const calcRetires = ({ birth, gender, occupation }: calcRetiresParams): calcRetiresReturnType => {
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
    throw new Error('请输入正确的性别和职业')
  }

  const tryretiredate = dayjs(birthDay).add(baseRetirementAge * 12, 'M')

  // 判断是否在2025年1月1日之前可以退休
  if (tryretiredate.isBefore(startCalcDay)) {
    // 在2025年前退休，使用旧政策
    return {
      newRetirementPolicy: false,
      retirementDate: tryretiredate.toDate(),
      baseRetirementAge,
      baseRetirementMonth: 0,
    }
  }

  // 如果在2025年后退休，计算延迟幅度

  const monthsUntil2025 = tryretiredate.diff(startCalcDay, 'month')
  if (gender === 'male') {
    delayMonths = Math.floor((monthsUntil2025) / 4) // 男性每4个月延迟1个月
    if (baseRetirementAge + delayMonths / 12 > 63) {
      delayMonths = (63 - baseRetirementAge) * 12 // 最多延迟到63岁
    }
  } else if (gender === 'female' && occupation === 'worker') {
    delayMonths = Math.floor((monthsUntil2025) / 2) // 女性工人每2个月延迟1个月
    if (baseRetirementAge + delayMonths / 12 > 55) {
      delayMonths = (55 - baseRetirementAge) * 12 // 最多延迟到55岁
    }
  } else if (gender === 'female' && occupation === 'staff') {
    delayMonths = Math.floor((monthsUntil2025) / 4) // 女性职员每4个月延迟1个月
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
    newRetirementPolicy: true,
    retirementDate: retireDate.toDate(),
    baseRetirementAge: finalAge,
    baseRetirementMonth: finalMonths,
  }
}
