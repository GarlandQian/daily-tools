import type { Metadata } from 'next'

import PdfClient from '@/features/preview/components/PdfClient'

export const metadata: Metadata = {
  title: 'PDF Preview - Daily Tools',
  description:
    'Preview PDF files locally with browser-only rendering, file validation, metadata, reupload, clear, and original download controls'
}

const PdfPage = () => {
  return <PdfClient />
}

export default PdfPage
