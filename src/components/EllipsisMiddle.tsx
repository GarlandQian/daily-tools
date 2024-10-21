import React, { useState } from 'react'
import { Typography } from 'antd'

const { Paragraph } = Typography

const EllipsisMiddle: React.FC<{ suffixCount: number; children: string; rows?: number }> = ({
  suffixCount,
  children,
  rows = 1,
}) => {
  const start = children.slice(0, children.length - suffixCount)
  const suffix = children.slice(-suffixCount).trim()
  const [expanded, setExpanded] = useState(false)
  return (
    <Paragraph
      style={{ maxWidth: '100%' }}
      ellipsis={{
        suffix,
        rows,
        expandable: 'collapsible',
        expanded,
        onExpand: (_, info) => setExpanded(info.expanded),
      }}
      copyable
    >
      {start}
    </Paragraph>
  )
}

export default EllipsisMiddle