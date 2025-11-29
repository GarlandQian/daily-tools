'use client'

import dynamic from 'next/dynamic'

const DocxPreviewer = dynamic(() => import('./DocxPreviewer'), { ssr: false })

const DocxClient = () => {
  return <DocxPreviewer />
}

export default DocxClient
