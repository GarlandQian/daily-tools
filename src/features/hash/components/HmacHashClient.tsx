'use client'

import CryptoJS from 'crypto-js'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  ListChecks,
  Search,
  Sparkles,
  XCircle
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
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

type HmacFamily = 'md5' | 'sha' | 'ripemd'
type ExportFormat = 'txt' | 'csv' | 'json'
type HmacAlgorithm =
  | 'HmacMD5'
  | 'HmacRIPEMD160'
  | 'HmacSHA1'
  | 'HmacSHA224'
  | 'HmacSHA256'
  | 'HmacSHA3'
  | 'HmacSHA384'
  | 'HmacSHA512'

interface HmacHashClientProps {
  family: HmacFamily
}

interface HmacResult {
  algorithm: HmacAlgorithm
  digest: string
  message: string
}

interface VerifyResult {
  digest: string
  plaintext: string
  success: boolean
}

const MAX_HMAC_INPUT_CHARS = 200000
const MAX_BATCH_LINES = 200
const MAX_KEY_CHARS = 4096
const numberFormatter = new Intl.NumberFormat()

const FAMILY_ALGORITHMS: Record<HmacFamily, HmacAlgorithm[]> = {
  md5: ['HmacMD5'],
  ripemd: ['HmacRIPEMD160'],
  sha: ['HmacSHA1', 'HmacSHA224', 'HmacSHA256', 'HmacSHA3', 'HmacSHA384', 'HmacSHA512']
}

const FAMILY_META: Record<HmacFamily, { descriptionKey: string; labelKey: string }> = {
  md5: {
    descriptionKey: 'app.hash.hmac.description.md5',
    labelKey: 'app.hash.hmacMD5'
  },
  ripemd: {
    descriptionKey: 'app.hash.hmac.description.ripemd',
    labelKey: 'app.hash.hmacRIPEMD'
  },
  sha: {
    descriptionKey: 'app.hash.hmac.description.sha',
    labelKey: 'app.hash.hmacSHA'
  }
}

const SAMPLES = {
  api: {
    key: 'daily-tools-webhook-secret',
    message: 'POST\n/api/webhook\n1700000000\n{"event":"deploy","ok":true}'
  },
  lines: {
    key: 'batch-signing-key',
    message: 'invoice-1001\ninvoice-1002\ninvoice-1003'
  },
  release: {
    key: 'release-signing-key',
    message: 'daily-tools-v1.8.0\nasset:daily-tools.zip\nsha256:pending'
  }
} as const

const calculateHmac = (algorithm: HmacAlgorithm, message: string, key: string) => {
  switch (algorithm) {
    case 'HmacMD5':
      return CryptoJS.HmacMD5(message, key).toString()
    case 'HmacRIPEMD160':
      return CryptoJS.HmacRIPEMD160(message, key).toString()
    case 'HmacSHA1':
      return CryptoJS.HmacSHA1(message, key).toString()
    case 'HmacSHA224':
      return CryptoJS.HmacSHA224(message, key).toString()
    case 'HmacSHA256':
      return CryptoJS.HmacSHA256(message, key).toString()
    case 'HmacSHA3':
      return CryptoJS.HmacSHA3(message, key).toString()
    case 'HmacSHA384':
      return CryptoJS.HmacSHA384(message, key).toString()
    case 'HmacSHA512':
      return CryptoJS.HmacSHA512(message, key).toString()
  }
}

const splitMessages = (input: string, lineByLine: boolean) => {
  if (!lineByLine) return input.trim() ? [input] : []
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH_LINES)
}

const csvEscape = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildExport = (results: HmacResult[], format: ExportFormat, includeMessage: boolean) => {
  if (format === 'json') {
    return JSON.stringify(
      results.map(result => ({
        algorithm: result.algorithm,
        digest: result.digest,
        ...(includeMessage ? { message: result.message } : {})
      })),
      null,
      2
    )
  }

  if (format === 'csv') {
    const header = includeMessage ? 'algorithm,message,digest' : 'algorithm,digest'
    const rows = results.map(result => {
      const values = includeMessage
        ? [result.algorithm, result.message, result.digest]
        : [result.algorithm, result.digest]
      return values.map(csvEscape).join(',')
    })
    return [header, ...rows].join('\n')
  }

  return results
    .map(result => {
      const messageLine = includeMessage ? `\n${result.message}` : ''
      return `${result.algorithm}: ${result.digest}${messageLine}`
    })
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

const HmacHashClient = ({ family }: HmacHashClientProps) => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const meta = FAMILY_META[family]
  const algorithms = FAMILY_ALGORITHMS[family]
  const [message, setMessage] = useState('')
  const [key, setKey] = useState('')
  const [enabledAlgorithms, setEnabledAlgorithms] = useState<HmacAlgorithm[]>(algorithms)
  const [lineByLine, setLineByLine] = useState(false)
  const [uppercase, setUppercase] = useState(false)
  const [includeMessage, setIncludeMessage] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt')
  const [verifyDigest, setVerifyDigest] = useState('')
  const [verifyAlgorithm, setVerifyAlgorithm] = useState<HmacAlgorithm>(algorithms[0])
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const deferredMessage = useDeferredValue(message)
  const deferredKey = useDeferredValue(key)
  const isMessageTooLarge = deferredMessage.length > MAX_HMAC_INPUT_CHARS
  const isKeyTooLarge = deferredKey.length > MAX_KEY_CHARS
  const values = useMemo(
    () => splitMessages(deferredMessage, lineByLine),
    [deferredMessage, lineByLine]
  )
  const activeAlgorithms = enabledAlgorithms.length ? enabledAlgorithms : algorithms
  const results = useMemo<HmacResult[]>(() => {
    if (!deferredKey.trim() || isMessageTooLarge || isKeyTooLarge) return []

    return values.flatMap(value =>
      activeAlgorithms.map(algorithm => {
        const digest = calculateHmac(algorithm, value, deferredKey)
        return {
          algorithm,
          digest: uppercase ? digest.toUpperCase() : digest,
          message: value
        }
      })
    )
  }, [activeAlgorithms, deferredKey, isKeyTooLarge, isMessageTooLarge, uppercase, values])
  const exportOutput = useMemo(
    () => buildExport(results, exportFormat, includeMessage),
    [exportFormat, includeMessage, results]
  )
  const exportMeta = {
    csv: { filename: `${family}-hmac.csv`, type: 'text/csv;charset=utf-8' },
    json: { filename: `${family}-hmac.json`, type: 'application/json;charset=utf-8' },
    txt: { filename: `${family}-hmac.txt`, type: 'text/plain;charset=utf-8' }
  }[exportFormat]
  const messageBytes = useMemo(
    () => new TextEncoder().encode(deferredMessage).length,
    [deferredMessage]
  )
  const keyBytes = useMemo(() => new TextEncoder().encode(deferredKey).length, [deferredKey])
  const digestChars = results.reduce((total, result) => total + result.digest.length, 0)
  const lineLimitReached =
    lineByLine && deferredMessage.split(/\r?\n/).filter(Boolean).length > MAX_BATCH_LINES
  const hasLegacyAlgorithm = activeAlgorithms.some(
    algorithm => algorithm === 'HmacMD5' || algorithm === 'HmacSHA1'
  )

  const toggleAlgorithm = (algorithm: HmacAlgorithm, checked: boolean) => {
    setEnabledAlgorithms(prev =>
      checked ? [...new Set([...prev, algorithm])] : prev.filter(item => item !== algorithm)
    )
    if (!checked && verifyAlgorithm === algorithm) {
      setVerifyAlgorithm(algorithms[0])
    }
  }

  const applySample = (sample: keyof typeof SAMPLES) => {
    setMessage(SAMPLES[sample].message)
    setKey(SAMPLES[sample].key)
    setLineByLine(sample === 'lines')
    setVerifyResult(null)
  }

  const handleVerify = () => {
    const trimmedKey = key.trim()
    const target = verifyDigest.trim().toLowerCase()

    if (!trimmedKey) {
      toast.warning(t('rules.msg.required', { msg: t('app.hash.key') }))
      return
    }

    if (!target) {
      toast.warning(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    const found = commonPasswords.find(
      password => calculateHmac(verifyAlgorithm, password, key).toLowerCase() === target
    )

    if (found) {
      setVerifyResult({ digest: target, plaintext: found, success: true })
      toast.success(t('app.hash.verify.success'))
      return
    }

    setVerifyResult({ digest: target, plaintext: t('app.hash.verify.fail'), success: false })
    toast.warning(t('app.hash.verify.fail'))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[var(--primary)]" />
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
                  {t(`app.hash.hmac.sample.${sample}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.hash.hmac.metric.message_bytes')} value={messageBytes} />
            <Metric label={t('app.hash.hmac.metric.key_bytes')} value={keyBytes} />
            <Metric label={t('app.hash.hmac.metric.results')} value={results.length} />
            <Metric label={t('app.hash.hmac.metric.digest_chars')} value={digestChars} />
          </div>

          {(hasLegacyAlgorithm || isMessageTooLarge || isKeyTooLarge || lineLimitReached) && (
            <div className="space-y-2">
              {hasLegacyAlgorithm && <Warning>{t('app.hash.hmac.warning.legacy')}</Warning>}
              {isMessageTooLarge && (
                <Warning>
                  {t('app.hash.hmac.warning.message_too_large', {
                    limit: numberFormatter.format(MAX_HMAC_INPUT_CHARS)
                  })}
                </Warning>
              )}
              {isKeyTooLarge && (
                <Warning>
                  {t('app.hash.hmac.warning.key_too_large', {
                    limit: numberFormatter.format(MAX_KEY_CHARS)
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
        <Card className="min-h-[600px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.hash.hmac.input')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="hmac-message">{t('app.hash.message')}</Label>
              <Textarea
                id="hmac-message"
                value={message}
                onChange={event => setMessage(event.target.value)}
                rows={9}
                placeholder={t('app.hash.hmac.message_placeholder')}
                className="font-mono"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="hmac-key">{t('app.hash.key')}</Label>
              <div className="flex gap-2">
                <Input
                  id="hmac-key"
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={event => setKey(event.target.value)}
                  placeholder={t('app.hash.hmac.key_placeholder')}
                  className="font-mono"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={showKey ? t('app.hash.hmac.hide_key') : t('app.hash.hmac.show_key')}
                  title={showKey ? t('app.hash.hmac.hide_key') : t('app.hash.hmac.show_key')}
                  onClick={() => setShowKey(current => !current)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

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
                      label={t('app.hash.hmac.line_by_line')}
                    />
                  </div>
                  <div className="glass-input rounded-xl px-3 py-2">
                    <Checkbox
                      checked={uppercase}
                      onChange={event => setUppercase(event.target.checked)}
                      label={t('app.hash.text.uppercase')}
                    />
                  </div>
                  <div className="glass-input rounded-xl px-3 py-2">
                    <Checkbox
                      checked={includeMessage}
                      onChange={event => setIncludeMessage(event.target.checked)}
                      label={t('app.hash.hmac.include_message')}
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
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!results.length}
                  onClick={() => copy(exportOutput)}
                >
                  {t('app.hash.text.copy_results')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  icon={<Download className="h-4 w-4" />}
                  disabled={!results.length}
                  onClick={() => downloadText(exportOutput, exportMeta.filename, exportMeta.type)}
                >
                  {t('app.hash.text.download')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-[600px] flex-col gap-5">
          <Card className="flex min-h-[320px] flex-1 flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.hash.file.results')}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto">
              {results.length ? (
                <div className="space-y-3">
                  {results.map((result, index) => (
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
                          {result.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-48 items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                  {t('app.hash.hmac.empty')}
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
              <CardDescription>{t('app.hash.hmac.verify_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                <Select
                  value={verifyAlgorithm}
                  onChange={event => setVerifyAlgorithm(event.target.value as HmacAlgorithm)}
                >
                  {algorithms.map(algorithm => (
                    <option key={algorithm} value={algorithm}>
                      {algorithm}
                    </option>
                  ))}
                </Select>
                <Input
                  value={verifyDigest}
                  onChange={event => setVerifyDigest(event.target.value)}
                  placeholder={t('app.hash.target')}
                  className="font-mono"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<Search className="h-4 w-4" />}
                onClick={handleVerify}
              >
                {t('public.verify')}
              </Button>
              {verifyResult && (
                <div
                  className="glass-input rounded-xl p-3 text-sm"
                  data-success={verifyResult.success ? 'true' : 'false'}
                >
                  <div className="flex items-start gap-2">
                    {verifyResult.success ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-[var(--error)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[var(--text-primary)]">
                        {verifyResult.plaintext}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                        {verifyResult.digest}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copy(verifyResult.plaintext)}
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

export default HmacHashClient
