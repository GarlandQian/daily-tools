/* eslint-disable react/prop-types */
'use client'
import { Select } from 'antd'
import FormItem from 'antd/es/form/FormItem'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VirtuosoGrid } from 'react-virtuoso'

import { tzListMap } from '@/const/timezone'

import { Clock } from './Clock'
dayjs.extend(utc)
dayjs.extend(timezone)

const GridList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={style}
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  >
    {children}
  </div>
))
GridList.displayName = 'GridList'

const GridItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className="flex justify-center">
    {children}
  </div>
)
GridItem.displayName = 'GridItem'

const TimeClient = () => {
  const { t } = useTranslation()
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
      <VirtuosoGrid
        style={{ height: '100%', flex: 1 }}
        data={Object.keys(tzListFilterMap)}
        components={{
          List: GridList,
          Item: GridItem
        }}
        itemContent={(index, tz) => (
          <Clock key={tz} tz={tz as keyof typeof tzListMap} />
        )}
      />
    </div>
  )
}

export default TimeClient
