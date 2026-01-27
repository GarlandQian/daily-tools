'use client'
import { CSSProperties } from 'react'

export default function TransitionLayout({
  children,
  style
}: Readonly<{
  children: React.ReactNode
  style?: CSSProperties
}>) {
  return (
    <div style={style}>
      <div style={{ minHeight: '100%', paddingBottom: 24 }}>{children}</div>
    </div>
  )
}
