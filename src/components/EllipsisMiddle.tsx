'use client'

import { ChevronDown, ChevronUp, Copy } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

const EllipsisMiddle: React.FC<{
  suffixCount: number
  children: string
  rows?: number
}> = ({ suffixCount, children, rows = 1 }) => {
  const { t } = useTranslation()
  const start = children.slice(0, children.length - suffixCount)
  const suffix = children.slice(-suffixCount).trim()
  const [expanded, setExpanded] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
  }

  return (
    <div className="max-w-full">
      <div className="flex items-start gap-2">
        <p
          className={cn(
            'flex-1 text-sm text-[var(--text-primary)] break-all',
            !expanded && `line-clamp-${rows}`
          )}
        >
          {start}
          <span className="text-[var(--text-secondary)]">{suffix}</span>
        </p>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-[var(--glass-bg-hover)] rounded transition-all"
            title={t('public.copy')}
          >
            <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-[var(--glass-bg-hover)] rounded transition-all"
            title={expanded ? t('public.collapse') : t('public.expand')}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EllipsisMiddle
