'use client'

import { Copy, ImageIcon, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUploadZone } from '@/components/ui/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const ImageBase64Client = () => {
  const { t } = useTranslation()
  const toast = useToast()

  const [base64, setBase64] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [includeDataUri, setIncludeDataUri] = useState(true)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string } | null>(
    null
  )

  const handleFileChange = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }

      const reader = new FileReader()
      reader.onload = e => {
        const result = e.target?.result as string
        setBase64(result)
        setPreviewUrl(result)
        setFileInfo({
          name: file.name,
          size: file.size,
          type: file.type
        })
      }
      reader.onerror = () => {
        toast.error(t('public.generate_failed'))
      }
      reader.readAsDataURL(file)
    },
    [toast, t]
  )

  const handleCopy = useCallback(() => {
    if (!base64) return
    const textToCopy = includeDataUri ? base64 : base64.split(',')[1] || base64
    navigator.clipboard.writeText(textToCopy)
    toast.success(t('app.social.retires.copy_success'))
  }, [base64, includeDataUri, toast, t])

  const displayedBase64 = includeDataUri ? base64 : base64.split(',')[1] || ''

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('app.converter.image')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadZone accept="image/*" onChange={handleFileChange}>
            <Upload className="w-10 h-10 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {t('app.converter.image.upload')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{t('app.converter.image.hint')}</p>
          </FileUploadZone>

          {/* File info chips */}
          {fileInfo && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs glass-panel border border-[var(--border-base)]">
                <span className="text-[var(--text-tertiary)]">
                  {t('app.converter.image.filename')}:
                </span>
                <span className="text-[var(--text-primary)] font-medium">{fileInfo.name}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs glass-panel border border-[var(--border-base)]">
                <span className="text-[var(--text-tertiary)]">
                  {t('app.converter.image.size')}:
                </span>
                <span className="text-[var(--text-primary)] font-medium font-mono">
                  {formatSize(fileInfo.size)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs glass-panel border border-[var(--border-base)]">
                <span className="text-[var(--text-tertiary)]">
                  {t('app.converter.image.type')}:
                </span>
                <span className="text-[var(--primary)] font-mono">{fileInfo.type}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview + Base64 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Preview */}
        <Card className="md:col-span-1 flex flex-col h-full min-h-[280px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.image.preview')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {previewUrl ? (
              <div className="rounded-xl border border-[var(--border-base)] glass-panel p-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="block max-w-full max-h-[300px] rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)] py-12">
                <ImageIcon className="w-10 h-10" />
                <span className="text-sm">{t('app.converter.image.no_image')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Base64 textarea */}
        <Card className="md:col-span-2 flex flex-col h-full min-h-[280px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">Base64</CardTitle>
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={includeDataUri}
                  onChange={e => setIncludeDataUri(e.target.checked)}
                  label="Include Data URI"
                />
                <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy} disabled={!base64}>
                  {t('app.generation.uuid.copy')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={displayedBase64}
              readOnly
              placeholder="Base64 output will appear here..."
              className="h-full min-h-[200px] resize-none font-mono text-xs"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ImageBase64Client
