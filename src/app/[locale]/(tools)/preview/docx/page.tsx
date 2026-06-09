import type { Metadata } from 'next'

import DocxClient from '@/features/preview/components/DocxClient'

export const metadata: Metadata = {
  title: 'DOCX Preview - Daily Tools',
  description:
    'Preview DOCX files locally in the browser with file details and safe reupload controls'
}

const DocxPage = () => {
  return <DocxClient />
}

export default DocxPage
