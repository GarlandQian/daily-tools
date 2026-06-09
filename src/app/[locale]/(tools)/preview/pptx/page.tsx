import type { Metadata } from 'next'

import PptxClient from '@/features/preview/components/PptxClient'

export const metadata: Metadata = {
  title: 'PPTX Preview - Daily Tools',
  description:
    'Preview PPTX slide decks locally with browser-only rendering, file validation, metadata, reupload, clear, and original download controls'
}

const PptxPage = () => {
  return <PptxClient />
}

export default PptxPage
