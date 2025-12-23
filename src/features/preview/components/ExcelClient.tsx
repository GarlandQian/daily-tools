'use client'

import dynamic from 'next/dynamic'

const ExcelPreviewer = dynamic(() => import('./ExcelPreviewer'), { ssr: false })

const ExcelClient = () => {
  return <ExcelPreviewer />
}

export default ExcelClient
