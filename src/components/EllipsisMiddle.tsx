import React, { useState } from 'react'
import { Copy, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

const EllipsisMiddle: React.FC<{
  suffixCount: number
  children: string
  rows?: number
}> = ({ suffixCount, children, rows = 1 }) => {
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
            title="Copy"
          >
            <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-[var(--glass-bg-hover)] rounded transition-all"
            title={expanded ? 'Collapse' : 'Expand'}
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
