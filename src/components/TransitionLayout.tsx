'use client'
import { CSSProperties } from 'react'



export default function TransitionLayout({
  children,
  style
}: Readonly<{
  children: React.ReactNode
  style?: CSSProperties
}>) {
  return <div style={style}>{children}</div>
}
