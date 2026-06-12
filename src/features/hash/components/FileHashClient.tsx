'use client'

import {
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Hash,
  Loader2,
  Search,
  Trash2,
  Upload
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUploadZone } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import { yieldToMain } from '@/utils/scheduler'

import { arrayBufferToWordArray, hashWordArray, loadCryptoJS } from '../utils/crypto'

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

type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'
type ExportFormat = 'txt' | 'csv' | 'json'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_VISIBLE_HASH_RESULTS = 40
const HASH_ALGORITHMS: HashAlgorithm[] = ['md5', 'sha1', 'sha256', 'sha512']
const HEX_TABLE = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'))

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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

  const cryptoJS = await loadCryptoJS()
  const wordArray = arrayBufferToWordArray(cryptoJS, buffer)
  const hashes = hashWordArray(cryptoJS, wordArray, {
    sha1: sha1Digest ?? undefined,
    sha256: sha256Digest ?? undefined,
    sha512: sha512Digest ?? undefined
  })

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    ...hashes
  }
}

const csvEscape = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildExport = (
  results: FileHashResult[],
  algorithms: HashAlgorithm[],
  format: ExportFormat
) => {
  if (format === 'json') {
    return JSON.stringify(
      results.map(item => ({
        name: item.name,
        size: item.size,
        type: item.type,
        hashes: Object.fromEntries(algorithms.map(algorithm => [algorithm, item[algorithm]]))
      })),
      null,
      2
    )
  }

  if (format === 'csv') {
    const header = ['name', 'size', 'type', ...algorithms]
    const rows = results.map(item =>
      [item.name, item.size, item.type, ...algorithms.map(algorithm => item[algorithm])]
        .map(csvEscape)
        .join(',')
    )
    return [header.join(','), ...rows].join('\n')
  }

  return results
    .map(item =>
      [
        `${item.name} (${formatSize(item.size)})`,
        ...algorithms.map(algorithm => `${algorithm.toUpperCase()}: ${item[algorithm]}`)
      ].join('\n')
    )
    .join('\n\n')
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const FileHashClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const [results, setResults] = useState<FileHashResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [query, setQuery] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt')
  const [enabledAlgorithms, setEnabledAlgorithms] = useState<HashAlgorithm[]>(HASH_ALGORITHMS)
  const fileBatchRequestRef = useRef(0)
  const deferredQuery = useDeferredValue(query)

  const totalBytes = useMemo(() => results.reduce((total, item) => total + item.size, 0), [results])
  const filteredResults = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) return results
    return results.filter(
      item =>
        item.name.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        HASH_ALGORITHMS.some(algorithm => item[algorithm].includes(normalized))
    )
  }, [deferredQuery, results])
  const selectedAlgorithms = enabledAlgorithms.length ? enabledAlgorithms : HASH_ALGORITHMS
  const visibleResults = useMemo(
    () => filteredResults.slice(0, MAX_VISIBLE_HASH_RESULTS),
    [filteredResults]
  )
  const hiddenResultCount = Math.max(0, filteredResults.length - visibleResults.length)
  const exportMeta = {
    csv: { filename: 'file-hashes.csv', type: 'text/csv;charset=utf-8' },
    json: { filename: 'file-hashes.json', type: 'application/json;charset=utf-8' },
    txt: { filename: 'file-hashes.txt', type: 'text/plain;charset=utf-8' }
  }[exportFormat]
  const buildCurrentExport = useCallback(
    () => buildExport(filteredResults, selectedAlgorithms, exportFormat),
    [exportFormat, filteredResults, selectedAlgorithms]
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return

      const validFiles = files.filter(file => file.size <= MAX_FILE_SIZE)
      if (validFiles.length !== files.length) {
        toast.warning(t('app.hash.file.too_large'))
      }

      if (!validFiles.length) return

      setProcessing(true)
      const requestId = fileBatchRequestRef.current + 1
      fileBatchRequestRef.current = requestId

      try {
        const nextResults: FileHashResult[] = []
        for (const file of validFiles) {
          await yieldToMain()
          if (fileBatchRequestRef.current !== requestId) return
          nextResults.push(await hashFile(file))
          if (fileBatchRequestRef.current !== requestId) return
        }
        if (fileBatchRequestRef.current !== requestId) return
        setResults(prev => {
          const existingIds = new Set(prev.map(item => item.id))
          const uniqueResults = nextResults.filter(item => !existingIds.has(item.id))
          if (uniqueResults.length !== nextResults.length) {
            toast.warning(t('app.hash.file.duplicate_skipped'))
          }
          return [...uniqueResults, ...prev]
        })
        toast.success(t('public.success'))
      } catch {
        if (fileBatchRequestRef.current === requestId) toast.error(t('public.error'))
      } finally {
        if (fileBatchRequestRef.current === requestId) setProcessing(false)
      }
    },
    [toast, t]
  )

  const copyAll = () => copy(buildCurrentExport())

  const toggleAlgorithm = (algorithm: HashAlgorithm, checked: boolean) => {
    setEnabledAlgorithms(prev =>
      checked ? [...new Set([...prev, algorithm])] : prev.filter(item => item !== algorithm)
    )
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
                disabled={!filteredResults.length}
              >
                {t('app.generation.uuid.copy')}
              </Button>
              <Button
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(buildCurrentExport(), exportMeta.filename, exportMeta.type)
                }
                disabled={!filteredResults.length}
              >
                {t('app.hash.file.download')}
              </Button>
              <Button
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setResults([])
                  setQuery('')
                }}
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
            <Metric
              label={t('app.hash.file.algorithms')}
              value={selectedAlgorithms.map(algorithm => algorithm.toUpperCase()).join(' / ')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  value={query}
                  onChange={event => setQuery(event.target.value.slice(0, 160))}
                  placeholder={t('app.hash.file.search')}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {HASH_ALGORITHMS.map(algorithm => (
                  <div key={algorithm} className="glass-input rounded-xl px-3 py-2">
                    <Checkbox
                      checked={enabledAlgorithms.includes(algorithm)}
                      onChange={event => toggleAlgorithm(algorithm, event.target.checked)}
                      label={algorithm.toUpperCase()}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Select
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="txt">{t('app.hash.file.export.txt')}</option>
                <option value="csv">{t('app.hash.file.export.csv')}</option>
                <option value="json">{t('app.hash.file.export.json')}</option>
              </Select>
              <p className="text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.hash.file.filtered', {
                  count: filteredResults.length,
                  total: results.length
                })}
              </p>
            </div>
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
          {filteredResults.length ? (
            <div className="flex flex-col gap-4">
              {hiddenResultCount > 0 && (
                <p className="rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-xs text-[var(--warning)]">
                  {t('app.hash.file.render_limited', {
                    count: filteredResults.length,
                    visible: visibleResults.length
                  })}
                </p>
              )}
              {visibleResults.map(item => (
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
                            ...selectedAlgorithms.map(
                              algorithm => `${algorithm.toUpperCase()}: ${item[algorithm]}`
                            )
                          ].join('\n')
                        )
                      }
                    >
                      {t('public.copy')}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {selectedAlgorithms.map(algorithm => (
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
