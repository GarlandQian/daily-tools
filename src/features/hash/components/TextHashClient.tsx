'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Hash,
  ListChecks,
  Search,
  Sparkles,
  XCircle
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { commonPasswords } from '@/const/common-passwords'
import { useCopy } from '@/hooks/useCopy'

import { calculateTextHash, loadCryptoJS, type TextHashAlgorithm } from '../utils/crypto'
import { type HashLookupAlgorithm, lookupHash } from '../utils/lookup'

type HashFamily = 'md5' | 'sha' | 'ripemd'
type ExportFormat = 'txt' | 'csv' | 'json'

interface TextHashResult {
  algorithm: TextHashAlgorithm
  digest: string
  input: string
}

interface HashCalculationState {
  isLoading: boolean
  results: TextHashResult[]
}

interface LookupResult {
  digest: string
  plaintext: string
  success: boolean
}

interface TextHashClientProps {
  family: HashFamily
}

const MAX_HASH_INPUT_CHARS = 200000
const MAX_HASH_LIVE_INPUT_CHARS = 50000
const MAX_BATCH_LINES = 200
const VISIBLE_HASH_RESULT_LIMIT = 80
const MAX_HASH_LOOKUP_DIGEST_CHARS = 512
const numberFormatter = new Intl.NumberFormat()

const FAMILY_ALGORITHMS: Record<HashFamily, TextHashAlgorithm[]> = {
  md5: ['MD5'],
  ripemd: ['RIPEMD160'],
  sha: ['SHA1', 'SHA224', 'SHA256', 'SHA3', 'SHA384', 'SHA512']
}

const LOOKUP_ALGORITHMS: Partial<Record<TextHashAlgorithm, HashLookupAlgorithm>> = {
  MD5: 'md5',
  RIPEMD160: 'ripemd160',
  SHA1: 'sha1',
  SHA224: 'sha224',
  SHA256: 'sha256',
  SHA3: 'sha3_512',
  SHA384: 'sha384',
  SHA512: 'sha512'
}

const FAMILY_META: Record<HashFamily, { descriptionKey: string; labelKey: string; title: string }> =
  {
    md5: {
      descriptionKey: 'app.hash.text.description.md5',
      labelKey: 'app.hash.md5',
      title: 'MD5'
    },
    ripemd: {
      descriptionKey: 'app.hash.text.description.ripemd',
      labelKey: 'app.hash.ripemd',
      title: 'RIPEMD-160'
    },
    sha: {
      descriptionKey: 'app.hash.text.description.sha',
      labelKey: 'app.hash.sha',
      title: 'SHA'
    }
  }

const SAMPLES = {
  api: 'daily-tools:user:42:read-write',
  lines: 'alpha\nbeta\ngamma',
  release: 'daily-tools-v1.8.0\nsha-check\n2026-06-08'
} as const

const splitInput = (input: string, lineByLine: boolean) => {
  if (!lineByLine) return input.trim() ? [input] : []
  const lines: string[] = []
  let lineStart = 0

  for (let index = 0; index <= input.length && lines.length < MAX_BATCH_LINES; index += 1) {
    if (index < input.length && input[index] !== '\n') continue

    const lineEnd = input[index - 1] === '\r' ? index - 1 : index
    const line = input.slice(lineStart, lineEnd).trim()
    if (line) lines.push(line)
    lineStart = index + 1
  }

  return lines
}

const hasMoreNonEmptyLines = (input: string, limit: number) => {
  let count = 0
  let lineStart = 0

  for (let index = 0; index <= input.length; index += 1) {
    if (index < input.length && input[index] !== '\n') continue

    const lineEnd = input[index - 1] === '\r' ? index - 1 : index
    if (input.slice(lineStart, lineEnd).trim()) count += 1
    if (count > limit) return true
    lineStart = index + 1
  }

  return false
}

const csvEscape = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildExport = (results: TextHashResult[], format: ExportFormat) => {
  if (format === 'json') return JSON.stringify(results, null, 2)
  if (format === 'csv') {
    const rows = results.map(result =>
      [result.algorithm, result.input, result.digest].map(csvEscape).join(',')
    )
    return ['algorithm,input,digest', ...rows].join('\n')
  }
  return results
    .map(
      result =>
        `${result.algorithm}: ${result.digest}${results.length > 1 ? `\n${result.input}` : ''}`
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

const TextHashClient = ({ family }: TextHashClientProps) => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const meta = FAMILY_META[family]
  const algorithms = FAMILY_ALGORITHMS[family]
  const [input, setInput] = useState('')
  const [isInputCapped, setIsInputCapped] = useState(false)
  const [enabledAlgorithms, setEnabledAlgorithms] = useState<TextHashAlgorithm[]>(algorithms)
  const [lineByLine, setLineByLine] = useState(false)
  const [uppercase, setUppercase] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt')
  const [lookupDigest, setLookupDigest] = useState('')
  const [lookupAlgorithm, setLookupAlgorithm] = useState<TextHashAlgorithm>(algorithms[0])
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [hashState, setHashState] = useState<HashCalculationState>({
    isLoading: false,
    results: []
  })
  const hashRequestRef = useRef(0)
  const lookupRequestRef = useRef(0)
  const deferredInput = useDeferredValue(input)
  const isInputTooLarge = isInputCapped || deferredInput.length > MAX_HASH_INPUT_CHARS
  const safeInput = useMemo(
    () => (isInputTooLarge ? deferredInput.slice(0, MAX_HASH_INPUT_CHARS) : deferredInput),
    [deferredInput, isInputTooLarge]
  )
  const values = useMemo(() => splitInput(safeInput, lineByLine), [lineByLine, safeInput])
  const activeAlgorithms = enabledAlgorithms.length ? enabledAlgorithms : algorithms
  const results = hashState.results
  const isHashing = hashState.isLoading
  const exportMeta = {
    csv: { filename: `${family}-hashes.csv`, type: 'text/csv;charset=utf-8' },
    json: { filename: `${family}-hashes.json`, type: 'application/json;charset=utf-8' },
    txt: { filename: `${family}-hashes.txt`, type: 'text/plain;charset=utf-8' }
  }[exportFormat]
  const visibleResults = useMemo(() => results.slice(0, VISIBLE_HASH_RESULT_LIMIT), [results])
  const isResultPreviewLimited = results.length > visibleResults.length
  const digestChars = useMemo(
    () => results.reduce((total, result) => total + result.digest.length, 0),
    [results]
  )
  const inputBytes = useMemo(() => new TextEncoder().encode(safeInput).length, [safeInput])
  const lineLimitReached =
    lineByLine && !isInputTooLarge && hasMoreNonEmptyLines(safeInput, MAX_BATCH_LINES)
  const isLiveHashDeferred =
    safeInput.length > MAX_HASH_LIVE_INPUT_CHARS && !isInputTooLarge && values.length > 0

  const calculateResults = useCallback(async () => {
    const cryptoJS = await loadCryptoJS()

    return values.flatMap(value =>
      activeAlgorithms.map(algorithm => {
        const digest = calculateTextHash(cryptoJS, algorithm, value)
        return {
          algorithm,
          digest: uppercase ? digest.toUpperCase() : digest,
          input: value
        }
      })
    )
  }, [activeAlgorithms, uppercase, values])

  useEffect(() => {
    const requestId = hashRequestRef.current + 1
    hashRequestRef.current = requestId

    if (isInputTooLarge || isLiveHashDeferred || !values.length) {
      setHashState({ isLoading: false, results: [] })
      return
    }

    let isCurrent = true
    setHashState({ isLoading: true, results: [] })

    void calculateResults()
      .then(nextResults => {
        if (!isCurrent || hashRequestRef.current !== requestId) return
        setHashState({ isLoading: false, results: nextResults })
      })
      .catch(() => {
        if (!isCurrent || hashRequestRef.current !== requestId) return
        setHashState({ isLoading: false, results: [] })
        toast.error(t('public.error'))
      })

    return () => {
      isCurrent = false
    }
  }, [calculateResults, isInputTooLarge, isLiveHashDeferred, t, toast, values.length])

  useEffect(() => {
    lookupRequestRef.current += 1
    setLookupLoading(false)
    setLookupResult(null)
  }, [lookupAlgorithm, lookupDigest])

  const updateInput = useCallback((value: string) => {
    const capped = value.length > MAX_HASH_INPUT_CHARS
    setIsInputCapped(capped)
    setInput(capped ? value.slice(0, MAX_HASH_INPUT_CHARS) : value)
  }, [])

  const toggleAlgorithm = (algorithm: TextHashAlgorithm, checked: boolean) => {
    setEnabledAlgorithms(prev =>
      checked ? [...new Set([...prev, algorithm])] : prev.filter(item => item !== algorithm)
    )
    if (!checked && lookupAlgorithm === algorithm) {
      setLookupAlgorithm(algorithms[0])
    }
  }

  const handleLookup = async () => {
    const target = lookupDigest.trim().toLowerCase()
    if (!target) {
      toast.warning(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    setLookupLoading(true)
    setLookupResult(null)
    const requestId = lookupRequestRef.current + 1
    lookupRequestRef.current = requestId

    try {
      const cryptoJS = await loadCryptoJS()
      if (lookupRequestRef.current !== requestId) return

      const foundLocal = commonPasswords.find(
        password => calculateTextHash(cryptoJS, lookupAlgorithm, password).toLowerCase() === target
      )
      if (foundLocal) {
        if (lookupRequestRef.current !== requestId) return
        setLookupResult({ digest: target, plaintext: foundLocal, success: true })
        toast.success(t('app.hash.verify.success'))
        return
      }

      const lookupName = LOOKUP_ALGORITHMS[lookupAlgorithm]
      const apiResult = lookupName ? await lookupHash(lookupName, target) : null
      if (lookupRequestRef.current !== requestId) return
      if (apiResult) {
        setLookupResult({ digest: target, plaintext: apiResult, success: true })
        toast.success(t('app.hash.verify.success'))
        return
      }

      setLookupResult({ digest: target, plaintext: t('app.hash.verify.fail'), success: false })
      toast.warning(t('app.hash.verify.fail'))
    } catch {
      if (lookupRequestRef.current === requestId) toast.error(t('public.error'))
    } finally {
      if (lookupRequestRef.current === requestId) setLookupLoading(false)
    }
  }

  const applySample = (sample: keyof typeof SAMPLES) => {
    setIsInputCapped(false)
    setInput(SAMPLES[sample])
    setLineByLine(sample !== 'api')
    setLookupResult(null)
  }

  const handleCopyResults = () => {
    if (isHashing || !results.length) return
    void copy(buildExport(results, exportFormat))
  }

  const handleDownloadResults = () => {
    if (isHashing || !results.length) return
    downloadText(buildExport(results, exportFormat), exportMeta.filename, exportMeta.type)
  }

  const handleGenerateResults = async () => {
    if (isInputTooLarge || !values.length) return

    const requestId = hashRequestRef.current + 1
    hashRequestRef.current = requestId
    setHashState({ isLoading: true, results: [] })

    try {
      const nextResults = await calculateResults()
      if (hashRequestRef.current !== requestId) return
      setHashState({ isLoading: false, results: nextResults })
    } catch {
      if (hashRequestRef.current !== requestId) return
      setHashState({ isLoading: false, results: [] })
      toast.error(t('public.error'))
    }
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-[var(--primary)]" />
                {t(meta.labelKey)}
              </CardTitle>
              <CardDescription>{t(meta.descriptionKey)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SAMPLES) as Array<keyof typeof SAMPLES>).map(sample => (
                <Button
                  key={sample}
                  type="button"
                  size="sm"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  onClick={() => applySample(sample)}
                >
                  {t(`app.hash.text.sample.${sample}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.hash.text.metric.input_bytes')} value={inputBytes} />
            <Metric label={t('app.hash.text.metric.lines')} value={values.length} />
            <Metric label={t('app.hash.text.metric.results')} value={results.length} />
            <Metric label={t('app.hash.text.metric.digest_chars')} value={digestChars} />
          </div>

          {(isInputTooLarge || isLiveHashDeferred || lineLimitReached || family === 'md5') && (
            <div className="space-y-2">
              {family === 'md5' && <Warning>{t('app.hash.text.warning.md5_legacy')}</Warning>}
              {isInputTooLarge && (
                <Warning>
                  {t('app.hash.text.warning.too_large', {
                    limit: numberFormatter.format(MAX_HASH_INPUT_CHARS)
                  })}
                </Warning>
              )}
              {isLiveHashDeferred && (
                <Warning>
                  {t('app.hash.text.warning.live_deferred', {
                    limit: numberFormatter.format(MAX_HASH_LIVE_INPUT_CHARS)
                  })}
                </Warning>
              )}
              {lineLimitReached && (
                <Warning>
                  {t('app.hash.text.warning.line_limit', {
                    limit: numberFormatter.format(MAX_BATCH_LINES)
                  })}
                </Warning>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[560px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.hash.text.input')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Textarea
              value={input}
              onChange={event => updateInput(event.target.value)}
              rows={10}
              placeholder={t('app.hash.text.input_placeholder')}
              className="font-mono"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label>{t('app.hash.alg')}</Label>
                <div className="flex flex-wrap gap-2">
                  {algorithms.map(algorithm => (
                    <div key={algorithm} className="glass-input rounded-xl px-3 py-2">
                      <Checkbox
                        checked={enabledAlgorithms.includes(algorithm)}
                        onChange={event => toggleAlgorithm(algorithm, event.target.checked)}
                        label={algorithm}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t('app.hash.text.options')}</Label>
                <div className="flex flex-col gap-2">
                  <div className="glass-input rounded-xl px-3 py-2">
                    <Checkbox
                      checked={lineByLine}
                      onChange={event => setLineByLine(event.target.checked)}
                      label={t('app.hash.text.line_by_line')}
                    />
                  </div>
                  <div className="glass-input rounded-xl px-3 py-2">
                    <Checkbox
                      checked={uppercase}
                      onChange={event => setUppercase(event.target.checked)}
                      label={t('app.hash.text.uppercase')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
              <Select
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="txt">{t('app.hash.text.export.txt')}</option>
                <option value="csv">{t('app.hash.text.export.csv')}</option>
                <option value="json">{t('app.hash.text.export.json')}</option>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  icon={<Hash className="h-4 w-4" />}
                  loading={isHashing}
                  disabled={isInputTooLarge || !values.length}
                  onClick={handleGenerateResults}
                >
                  {t('app.hash.generate')}
                </Button>
                <Button
                  type="button"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={isHashing || !results.length}
                  onClick={handleCopyResults}
                >
                  {t('app.hash.text.copy_results')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Download className="h-4 w-4" />}
                  disabled={isHashing || !results.length}
                  onClick={handleDownloadResults}
                >
                  {t('app.hash.text.download')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-[560px] flex-col gap-5">
          <Card className="flex min-h-[300px] flex-1 flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.hash.file.results')}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto">
              {results.length ? (
                <div className="space-y-3">
                  {visibleResults.map((result, index) => (
                    <div
                      key={`${result.algorithm}-${index}-${result.digest}`}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
                          {result.algorithm}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copy(result.digest)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <code className="block break-all font-mono text-xs text-[var(--text-primary)]">
                        {result.digest}
                      </code>
                      {lineByLine && (
                        <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">
                          {result.input}
                        </p>
                      )}
                    </div>
                  ))}
                  {isResultPreviewLimited && (
                    <Warning>
                      {t('app.hash.text.warning.rows_limited', {
                        total: numberFormatter.format(results.length),
                        visible: numberFormatter.format(visibleResults.length)
                      })}
                    </Warning>
                  )}
                </div>
              ) : isHashing ? (
                <div className="flex min-h-48 items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                  {t('public.loading')}
                </div>
              ) : (
                <div className="flex min-h-48 items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                  {t('app.hash.text.empty')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-[var(--primary)]" />
                {t('app.hash.verify')}
              </CardTitle>
              <CardDescription>{t('app.hash.text.lookup_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                <Select
                  value={lookupAlgorithm}
                  onChange={event => setLookupAlgorithm(event.target.value as TextHashAlgorithm)}
                >
                  {algorithms.map(algorithm => (
                    <option key={algorithm} value={algorithm}>
                      {algorithm}
                    </option>
                  ))}
                </Select>
                <Input
                  value={lookupDigest}
                  onChange={event =>
                    setLookupDigest(event.target.value.slice(0, MAX_HASH_LOOKUP_DIGEST_CHARS))
                  }
                  placeholder={t('app.hash.target')}
                  maxLength={MAX_HASH_LOOKUP_DIGEST_CHARS}
                  className="font-mono"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<Search className="h-4 w-4" />}
                loading={lookupLoading}
                onClick={handleLookup}
              >
                {t('public.verify')}
              </Button>
              {lookupResult && (
                <div
                  className="glass-input rounded-xl p-3 text-sm"
                  data-success={lookupResult.success ? 'true' : 'false'}
                >
                  <div className="flex items-start gap-2">
                    {lookupResult.success ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-[var(--error)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[var(--text-primary)]">
                        {lookupResult.plaintext}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                        {lookupResult.digest}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copy(lookupResult.plaintext)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
      {numberFormatter.format(value)}
    </div>
  </div>
)

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{children}</span>
  </div>
)

export default TextHashClient
