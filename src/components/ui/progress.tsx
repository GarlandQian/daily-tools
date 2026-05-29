import * as React from 'react'

import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  showInfo?: boolean
  strokeColor?: string | { [key: string]: string }
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, showInfo = true, strokeColor, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const getGradient = () => {
      if (typeof strokeColor === 'string') {
        return strokeColor
      }
      if (strokeColor && typeof strokeColor === 'object') {
        const stops = Object.entries(strokeColor)
          .map(([percent, color]) => `${color} ${percent}`)
          .join(', ')
        return `linear-gradient(to right, ${stops})`
      }
      return 'var(--primary)'
    }

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 glass-input rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${percentage}%`,
                background: getGradient()
              }}
            />
          </div>
          {showInfo && (
            <span className="text-sm text-[var(--text-secondary)] min-w-[3rem] text-right">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
