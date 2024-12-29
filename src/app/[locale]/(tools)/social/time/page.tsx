'use client'
import { useRafInterval } from 'ahooks'
import { Select } from 'antd'
import FormItem from 'antd/es/form/FormItem'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Clock, tzDefault, tzListMap } from '@/components/Clock'
dayjs.extend(utc)
dayjs.extend(timezone)

const Time = () => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(dayjs())
  const [timeZonelist, setTimeZonelist] = useState<string[]>([])

  const tzListFilterMap = useMemo(() => {
    // 空默认显示全部
    if (timeZonelist.length === 0) {
      return tzListMap
    }
    // 过滤显示，按原结构返回 object
    const data = timeZonelist.reduce(
      (acc: { [key: string]: (typeof tzListMap)[keyof typeof tzListMap] }, cur) => {
        acc[cur] = tzListMap[cur as keyof typeof tzListMap]
        return acc
      },
      {}
    )
    return data
  }, [timeZonelist])

  useRafInterval(async () => {
    setCurrentTime(dayjs().tz(tzListMap[tzDefault].value))
  }, 1000)

  const onTimeZonelistChange = (value: string[]) => {
    setTimeZonelist(value)
  }

  return (
    <div className="flex size-full flex-col gap-[20px] overflow-hidden">
      <div>
        <FormItem label={t('app.social.time.timezone')}>
          <Select
            mode="multiple"
            options={Object.keys(tzListMap).map(item => ({
              label: tzListMap[item as keyof typeof tzListMap].label,
              value: item
            }))}
            allowClear
            onChange={onTimeZonelistChange}
          />
        </FormItem>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-4 overflow-y-auto overflow-x-hidden">
        {Object.keys(tzListFilterMap).map(tz => (
          <Clock key={tz} tz={tz as keyof typeof tzListMap} currentTime={currentTime} />
        ))}
      </div>
    </div>
  )
}

export default Time
