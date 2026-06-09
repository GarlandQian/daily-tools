import type { Metadata } from 'next'

import ExcelClient from '@/features/preview/components/ExcelClient'

export const metadata: Metadata = {
  title: 'Excel Preview - Daily Tools',
  description: 'Preview XLSX and XLS spreadsheets locally in the browser with file details'
}

const ExcelPage = () => {
  return <ExcelClient />
}

export default ExcelPage
