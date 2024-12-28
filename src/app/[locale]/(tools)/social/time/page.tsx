'use client'
import { useRafInterval } from 'ahooks'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import React, { useState } from 'react'

import { Clock, tzDefault, tzListMap } from '@/components/Clock'
dayjs.extend(utc)
dayjs.extend(timezone)

const Time = () => {
  const [currentTime, setCurrentTime] = useState(dayjs())

  useRafInterval(async () => {
    setCurrentTime(dayjs().tz(tzListMap[tzDefault].value))
  }, 1000)

  return (
    <div className="grid grid-cols-4 gap-4 overflow-auto w-full h-full">
      {Object.keys(tzListMap).map((tz) => (
        <Clock key={tz} tz={tz as keyof typeof tzListMap} currentTime={currentTime} />
      ))}
    </div>
  )
}

export default Time
