'use client'

import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import type { RefObject } from 'react'
import { useEffect } from 'react'

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrcodeImageSettings {
  src: string
  width: number
  height: number
  excavate: boolean
}

export interface QrcodeRendererProps {
  bgColor: string
  boostLevel: boolean
  fgColor: string
  imageSettings?: QrcodeImageSettings
  level: ErrorCorrectionLevel
  marginSize: number
  onReady?: () => void
  size: number
  svgRef: RefObject<SVGSVGElement | null>
  title: string
  value: string
}

export const QrcodeRenderer = ({ onReady, svgRef, ...qrProps }: QrcodeRendererProps) => {
  useEffect(() => {
    onReady?.()
  }, [onReady])

  return (
    <>
      <QRCodeCanvas {...qrProps} />
      <QRCodeSVG ref={svgRef} {...qrProps} className="hidden" />
    </>
  )
}
