'use client'

import { Upload as UploadIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface FileUploaderProps {
  accept?: string
  multiple?: boolean
  maxSize?: number
  onChange?: (files: File[]) => void
  children?: React.ReactNode
  className?: string
  disabled?: boolean
}

function FileUploadZone({
  accept,
  multiple = false,
  maxSize,
  onChange,
  children,
  className,
  disabled
}: FileUploaderProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    const filtered = maxSize ? fileArray.filter(f => f.size <= maxSize) : fileArray
    onChange?.(filtered)
  }

  return (
    <div
      className={cn(
        'glass-input rounded-xl border-2 border-dashed border-[var(--border-base)] p-8',
        'flex flex-col items-center justify-center gap-3 cursor-pointer',
        'transition-all duration-200',
        isDragging && 'border-[var(--primary)] bg-[var(--primary-subtle)] scale-[1.01]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        disabled={disabled}
      />
      {children || (
        <>
          <UploadIcon className="w-8 h-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">{t('public.upload_hint')}</p>
        </>
      )}
    </div>
  )
}

export { FileUploadZone }
