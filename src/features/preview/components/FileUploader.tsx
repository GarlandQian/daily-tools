'use client'
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FileUploadZone } from '@/components/ui/file-upload'

interface FileUploaderProps {
  accept: string
  onUpload: (file: File) => void
  disabled?: boolean
  tip?: string
}

const FileUploader = ({ accept, onUpload, disabled = false, tip }: FileUploaderProps) => {
  const { t } = useTranslation()

  const handleFiles = (files: File[]) => {
    if (files.length > 0) {
      onUpload(files[0])
    }
  }

  return (
    <FileUploadZone
      accept={accept}
      multiple={false}
      onChange={handleFiles}
      disabled={disabled}
      className="p-8"
    >
      <Inbox className="w-12 h-12 text-[var(--text-tertiary)]" />
      <p className="text-base text-[var(--text-primary)] font-medium">{t('public.upload_file')}</p>
      <p className="text-sm text-[var(--text-secondary)]">
        {tip || t('public.support_files', { type: accept })}
      </p>
    </FileUploadZone>
  )
}

export default FileUploader
