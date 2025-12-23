'use client'

import dynamic from 'next/dynamic'

const PptxPreviewer = dynamic(() => import('./PptxPreviewer'), { ssr: false })

const PptxClient = () => {
  return <PptxPreviewer />
}

export default PptxClient
