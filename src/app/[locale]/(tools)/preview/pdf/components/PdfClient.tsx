'use client'

import dynamic from 'next/dynamic'

const PdfPreviewer = dynamic(() => import('./PdfPreviewer'), { ssr: false })

const PdfClient = () => {
  return <PdfPreviewer />
}

export default PdfClient
