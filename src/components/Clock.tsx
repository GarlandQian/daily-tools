'use client'
import { useRafInterval } from 'ahooks'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { GaugeChart } from 'echarts/charts'
import {
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import ReactECharts from 'echarts-for-react'
import React, { useMemo, useRef } from 'react'

import { tzListMap, tzMap } from '@/const/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
// Register the required components
echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  GaugeChart,
  SVGRenderer
])

interface ClockProps {
  tz: tzMap
}

const Clock: React.FC<ClockProps> = ({ tz }) => {
  const chartRef = useRef<ReactECharts>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  useRafInterval(() => {
    const nowTime = dayjs().tz(tzListMap[tz].value)
    const second = nowTime.second()
    const minute = nowTime.minute() + second / 60
    const hour = (nowTime.hour() % 12) + minute / 60

    if (chartRef.current) {
      const instance = chartRef.current.getEchartsInstance()
      instance.setOption({
        series: [
          {
            name: 'hour',
            animation: hour !== 0,
            data: [{ value: hour }]
          },
          {
            name: 'minute',
            animation: minute !== 0,
            data: [{ value: minute }]
          },
          {
            name: 'second',
            animation: second !== 0,
            data: [{ value: second }]
          }
        ]
      })
    }

    if (timeRef.current) {
      timeRef.current.innerText = nowTime.format('YYYY-MM-DD HH:mm:ss')
    }
  }, 1000)

  // 生成配置项
  const options = useMemo(
    () => ({
      series: [
        {
          name: 'hour',
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 12,
          splitNumber: 12,
          clockwise: true,
          axisLine: {
            lineStyle: {
              width: 15,
              color: [[1, 'rgba(0,0,0,0.7)']],
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              shadowBlur: 15
            }
          },
          splitLine: {
            lineStyle: {
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 3,
              shadowOffsetX: 1,
              shadowOffsetY: 2
            }
          },
          axisLabel: {
            fontSize: 16,
            distance: 25,
            formatter: function (value: string | number) {
              if (value === 0) {
                return ''
              }
              return value + ''
            }
          },
          pointer: {
            icon: 'path://M2.9,0.7L2.9,0.7c1.4,0,2.6,1.2,2.6,2.6v115c0,1.4-1.2,2.6-2.6,2.6l0,0c-1.4,0-2.6-1.2-2.6-2.6V3.3C0.3,1.9,1.4,0.7,2.9,0.7z',
            width: 12,
            length: '55%',
            offsetCenter: [0, '8%'],
            itemStyle: {
              color: '#C0911F',
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 8,
              shadowOffsetX: 2,
              shadowOffsetY: 4
            }
          },
          detail: {
            show: false
          },
          title: {
            offsetCenter: [0, '30%']
          },
          data: [{ value: 0 }]
        },
        {
          name: 'minute',
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 60,
          clockwise: true,
          axisLine: {
            show: false
          },
          splitLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            show: false
          },
          pointer: {
            icon: 'path://M2.9,0.7L2.9,0.7c1.4,0,2.6,1.2,2.6,2.6v115c0,1.4-1.2,2.6-2.6,2.6l0,0c-1.4,0-2.6-1.2-2.6-2.6V3.3C0.3,1.9,1.4,0.7,2.9,0.7z',
            width: 8,
            length: '70%',
            offsetCenter: [0, '8%'],
            itemStyle: {
              color: '#C0911F',
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 8,
              shadowOffsetX: 2,
              shadowOffsetY: 4
            }
          },
          anchor: {
            show: true,
            size: 20,
            showAbove: false,
            itemStyle: {
              borderWidth: 15,
              borderColor: '#C0911F',
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 8,
              shadowOffsetX: 2,
              shadowOffsetY: 4
            }
          },
          detail: {
            show: false
          },
          title: {
            offsetCenter: ['0%', '-40%']
          },
          data: [{ value: 0 }]
        },
        {
          name: 'second',
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 60,
          animationEasingUpdate: 'bounceOut',
          clockwise: true,
          axisLine: {
            show: false
          },
          splitLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            show: false
          },
          pointer: {
            icon: 'path://M2.9,0.7L2.9,0.7c1.4,0,2.6,1.2,2.6,2.6v115c0,1.4-1.2,2.6-2.6,2.6l0,0c-1.4,0-2.6-1.2-2.6-2.6V3.3C0.3,1.9,1.4,0.7,2.9,0.7z',
            width: 4,
            length: '85%',
            offsetCenter: [0, '8%'],
            itemStyle: {
              color: '#C0911F',
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 8,
              shadowOffsetX: 2,
              shadowOffsetY: 4
            }
          },
          anchor: {
            show: true,
            size: 15,
            showAbove: true,
            itemStyle: {
              color: '#C0911F',
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 8,
              shadowOffsetX: 2,
              shadowOffsetY: 4
            }
          },
          detail: {
            show: false
          },
          title: {
            offsetCenter: ['0%', '-40%']
          },
          data: [{ value: 0 }]
        }
      ]
    }),
    []
  )

  return (
    <>
      <div className="flex w-full max-w-[300px] flex-col items-center justify-center gap-[10px]">
        <ReactECharts
          ref={chartRef}
          className="h-[300px] w-full"
          option={options}
          lazyUpdate={true}
          opts={{ renderer: 'svg' }}
        />
        <div>{`${tzListMap[tz].label}时间`}</div>
        <div ref={timeRef}>{dayjs().tz(tzListMap[tz].value).format('YYYY-MM-DD HH:mm:ss')}</div>
      </div>
    </>
  )
}

export { Clock }
