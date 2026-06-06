'use client'

import CryptoJS from 'crypto-js'
import {
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  Hash,
  Loader2,
  Trash2,
  Upload
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUploadZone } from '@/components/ui/file-upload'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import { yieldToMain } from '@/utils/scheduler'

interface FileHashResult {
  id: string
  name: string
  size: number
  type: string
  md5: string
  sha1: string
  sha256: string
  sha512: string
}

const MAX_FILE_SIZE = 50 * 1024 * 1024
const HEX_TABLE = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'))

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const arrayBufferToWordArray = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  const words: number[] = []

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] |= bytes[index] << (24 - (index % 4) * 8)
  }

  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

const arrayBufferToHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  const hex = new Array<string>(bytes.length)

  for (let index = 0; index < bytes.length; index += 1) {
    hex[index] = HEX_TABLE[bytes[index]]
  }

  return hex.join('')
}

const digestHex = async (algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512', buffer: ArrayBuffer) => {
  if (!crypto.subtle) return null

  try {
    return arrayBufferToHex(await crypto.subtle.digest(algorithm, buffer))
  } catch {
    return null
  }
}

const hashFile = async (file: File): Promise<FileHashResult> => {
  const buffer = await file.arrayBuffer()
  const [sha1Digest, sha256Digest, sha512Digest] = await Promise.all([
    digestHex('SHA-1', buffer),
    digestHex('SHA-256', buffer),
    digestHex('SHA-512', buffer)
  ])

  await yieldToMain()

  const wordArray = arrayBufferToWordArray(buffer)

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    md5: CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex),
    sha1: sha1Digest ?? CryptoJS.SHA1(wordArray).toString(CryptoJS.enc.Hex),
    sha256: sha256Digest ?? CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex),
    sha512: sha512Digest ?? CryptoJS.SHA512(wordArray).toString(CryptoJS.enc.Hex)
  }
}

const FileHashClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const [results, setResults] = useState<FileHashResult[]>([])
  const [processing, setProcessing] = useState(false)

  const totalBytes = useMemo(() => results.reduce((total, item) => total + item.size, 0), [results])

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return

      const validFiles = files.filter(file => file.size <= MAX_FILE_SIZE)
      if (validFiles.length !== files.length) {
        toast.warning(t('app.hash.file.too_large'))
      }

      if (!validFiles.length) return

      setProcessing(true)

      try {
        const nextResults: FileHashResult[] = []
        for (const file of validFiles) {
          await yieldToMain()
          nextResults.push(await hashFile(file))
        }
        setResults(prev => [...nextResults, ...prev])
        toast.success(t('public.success'))
      } catch {
        toast.error(t('public.error'))
      } finally {
        setProcessing(false)
      }
    },
    [toast, t]
  )

  const copyAll = () => {
    const output = results
      .map(item =>
        [
          `${item.name} (${formatSize(item.size)})`,
          `MD5: ${item.md5}`,
          `SHA1: ${item.sha1}`,
          `SHA256: ${item.sha256}`,
          `SHA512: ${item.sha512}`
        ].join('\n')
      )
      .join('\n\n')

    void copy(output)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.hash.file')}
              </CardTitle>
              <CardDescription>{t('app.hash.file.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={copyAll}
                disabled={!results.length}
              >
                {t('app.generation.uuid.copy')}
              </Button>
              <Button
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setResults([])}
                disabled={!results.length}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileUploadZone multiple onChange={handleFiles} disabled={processing}>
            {processing ? (
              <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
            ) : (
              <Upload className="h-10 w-10 text-[var(--text-tertiary)]" />
            )}
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {processing ? t('app.hash.file.processing') : t('app.hash.file.upload')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{t('app.hash.file.hint')}</p>
          </FileUploadZone>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label={t('app.hash.file.files')} value={String(results.length)} />
            <Metric label={t('app.hash.file.total_size')} value={formatSize(totalBytes)} />
            <Metric label={t('app.hash.file.algorithms')} value="MD5 / SHA1 / SHA256 / SHA512" />
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4 text-[var(--primary)]" />
            {t('app.hash.file.results')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {results.length ? (
            <div className="flex flex-col gap-4">
              {results.map(item => (
                <div
                  key={item.id}
                  className="glass-panel glass-clip rounded-2xl border border-[var(--glass-border)] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                        <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {item.name}
                        </h3>
                      </div>
                      <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                        {formatSize(item.size)} / {item.type}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() =>
                        copy(
                          [
                            `${item.name} (${formatSize(item.size)})`,
                            `MD5: ${item.md5}`,
                            `SHA1: ${item.sha1}`,
                            `SHA256: ${item.sha256}`,
                            `SHA512: ${item.sha512}`
                          ].join('\n')
                        )
                      }
                    >
                      {t('public.copy')}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {(['md5', 'sha1', 'sha256', 'sha512'] as const).map(algorithm => (
                      <HashRow
                        key={algorithm}
                        label={algorithm.toUpperCase()}
                        value={item[algorithm]}
                        onCopy={() => copy(item[algorithm])}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-center">
              <div className="max-w-sm">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--primary)]" />
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.hash.file.empty')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-4">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

const HashRow = ({
  label,
  onCopy,
  value
}: {
  label: string
  onCopy: () => void
  value: string
}) => (
  <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3 sm:flex-row sm:items-center">
    <span className="w-16 shrink-0 font-mono text-xs font-semibold text-[var(--text-secondary)]">
      {label}
    </span>
    <code className="min-w-0 flex-1 break-all font-mono text-xs text-[var(--text-primary)]">
      {value}
    </code>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy}>
      <Copy className="h-4 w-4" />
    </Button>
  </div>
)

export default FileHashClient
