'use client'

import CryptoJS from 'crypto-js'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react'
import { useMemo, useState } from 'react'
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

type DerivedLength = 16 | 24 | 32 | 48 | 64
type OutputFormat = 'base64' | 'hex' | 'json'
type PrfAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

interface DerivedOutput {
  base64: string
  hex: string
  json: string
}

interface VerifyResult {
  digest: string
  plaintext: string
  success: boolean
}

type PBKDFOptions = NonNullable<Parameters<typeof CryptoJS.PBKDF2>[2]>

const DERIVED_LENGTHS: DerivedLength[] = [16, 24, 32, 48, 64]
const MAX_PASSWORD_CHARS = 200000
const MAX_SALT_CHARS = 4096
const MAX_ITERATIONS = 600000
const ITERATION_PRESETS = [1000, 10000, 100000, 250000] as const
const numberFormatter = new Intl.NumberFormat()

const PRF_HASHERS: Record<PrfAlgorithm, PBKDFOptions['hasher']> = {
  SHA1: CryptoJS.algo.SHA1,
  SHA256: CryptoJS.algo.SHA256,
  SHA512: CryptoJS.algo.SHA512
}

const SAMPLES = {
  api: {
    iterations: 100000,
    length: 32,
    password: 'correct horse battery staple',
    prf: 'SHA256',
    salt: 'daily-tools:api:v1'
  },
  database: {
    iterations: 250000,
    length: 32,
    password: 'database rotation phrase',
    prf: 'SHA512',
    salt: 'prod-users-2026-06'
  },
  legacy: {
    iterations: 10000,
    length: 16,
    password: 'legacy-password',
    prf: 'SHA1',
    salt: 'legacy-salt'
  }
} satisfies Record<
  string,
  { iterations: number; length: DerivedLength; password: string; prf: PrfAlgorithm; salt: string }
>

const bytesToWords = (bytes: number) => bytes / 4

const deriveKey = (
  password: string,
  salt: string,
  length: DerivedLength,
  iterations: number,
  prf: PrfAlgorithm
) =>
  CryptoJS.PBKDF2(password, salt, {
    hasher: PRF_HASHERS[prf],
    iterations,
    keySize: bytesToWords(length)
  })

const buildOutput = (
  password: string,
  salt: string,
  length: DerivedLength,
  iterations: number,
  prf: PrfAlgorithm
): DerivedOutput | null => {
  if (!password.trim() || !salt.trim()) return null

  const wordArray = deriveKey(password, salt, length, iterations, prf)
  const hex = wordArray.toString(CryptoJS.enc.Hex)
  const base64 = wordArray.toString(CryptoJS.enc.Base64)

  return {
    base64,
    hex,
    json: JSON.stringify(
      {
        algorithm: 'PBKDF2',
        prf,
        iterations,
        salt,
        lengthBytes: length,
        hex,
        base64
      },
      null,
      2
    )
  }
}

const downloadText = (content: string, filename: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const PBKDFClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const [password, setPassword] = useState('')
  const [salt, setSalt] = useState('')
  const [derivedLength, setDerivedLength] = useState<DerivedLength>(32)
  const [iterations, setIterations] = useState(250000)
  const [prf, setPrf] = useState<PrfAlgorithm>('SHA256')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('hex')
  const [uppercase, setUppercase] = useState(false)
  const [verifyDigest, setVerifyDigest] = useState('')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const clampedIterations = Math.min(Math.max(1, iterations || 1), MAX_ITERATIONS)
  const isPasswordTooLarge = password.length > MAX_PASSWORD_CHARS
  const isSaltTooLarge = salt.length > MAX_SALT_CHARS
  const canDerive = !isPasswordTooLarge && !isSaltTooLarge && clampedIterations === iterations
  const output = useMemo(
    () => (canDerive ? buildOutput(password, salt, derivedLength, clampedIterations, prf) : null),
    [canDerive, clampedIterations, derivedLength, password, prf, salt]
  )
  const displayedHex = uppercase ? output?.hex.toUpperCase() : output?.hex
  const displayedOutput =
    outputFormat === 'json'
      ? output?.json
      : outputFormat === 'base64'
        ? output?.base64
        : displayedHex
  const entropyBits = derivedLength * 8
  const passwordBytes = useMemo(() => new TextEncoder().encode(password).length, [password])
  const saltBytes = useMemo(() => new TextEncoder().encode(salt).length, [salt])
  const warnings = [
    iterations < 10000 ? t('app.hash.pbkdf.warning.low_iterations') : null,
    prf === 'SHA1' ? t('app.hash.pbkdf.warning.sha1') : null,
    isPasswordTooLarge
      ? t('app.hash.pbkdf.warning.password_too_large', {
          limit: numberFormatter.format(MAX_PASSWORD_CHARS)
        })
      : null,
    isSaltTooLarge
      ? t('app.hash.pbkdf.warning.salt_too_large', {
          limit: numberFormatter.format(MAX_SALT_CHARS)
        })
      : null,
    iterations > MAX_ITERATIONS
      ? t('app.hash.pbkdf.warning.iteration_cap', {
          limit: numberFormatter.format(MAX_ITERATIONS)
        })
      : null
  ].filter(Boolean)

  const applySample = (sample: keyof typeof SAMPLES) => {
    const next = SAMPLES[sample]
    setPassword(next.password)
    setSalt(next.salt)
    setIterations(next.iterations)
    setDerivedLength(next.length)
    setPrf(next.prf)
    setVerifyResult(null)
  }

  const reset = () => {
    setPassword('')
    setSalt('')
    setDerivedLength(32)
    setIterations(250000)
    setPrf('SHA256')
    setOutputFormat('hex')
    setUppercase(false)
    setVerifyDigest('')
    setVerifyResult(null)
  }

  const handleVerify = () => {
    const target = verifyDigest.trim().toLowerCase()

    if (!salt.trim()) {
      toast.warning(t('rules.msg.required', { msg: t('app.hash.pbkdf.salt') }))
      return
    }

    if (!target) {
      toast.warning(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    if (!canDerive) {
      toast.warning(t('app.hash.pbkdf.warning.cannot_verify'))
      return
    }

    const found = commonPasswords.find(passwordCandidate => {
      const candidate = deriveKey(
        passwordCandidate,
        salt,
        derivedLength,
        clampedIterations,
        prf
      ).toString(CryptoJS.enc.Hex)
      return candidate.toLowerCase() === target
    })

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
                <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                PBKDF2
              </CardTitle>
              <CardDescription>{t('app.hash.pbkdf.description')}</CardDescription>
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
                  {t(`app.hash.pbkdf.sample.${sample}`)}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={reset}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.hash.pbkdf.metric.password_bytes')} value={passwordBytes} />
            <Metric label={t('app.hash.pbkdf.metric.salt_bytes')} value={saltBytes} />
            <Metric label={t('app.hash.pbkdf.metric.output_bits')} value={entropyBits} />
            <Metric
              label={t('app.hash.pbkdf.metric.hex_chars')}
              value={displayedHex?.length ?? 0}
            />
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map(warning => (
                <Warning key={warning}>{warning}</Warning>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-[var(--primary)]" />
              {t('app.hash.pbkdf.input')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="pbkdf-password">{t('app.hash.message')}</Label>
              <Textarea
                id="pbkdf-password"
                rows={6}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={t('app.hash.pbkdf.password_placeholder')}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="pbkdf-salt">{t('app.hash.pbkdf.salt')}</Label>
                <Input
                  id="pbkdf-salt"
                  value={salt}
                  onChange={event => setSalt(event.target.value)}
                  placeholder={t('app.hash.pbkdf.salt_placeholder')}
                  className="font-mono"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="pbkdf-prf">{t('app.hash.pbkdf.prf')}</Label>
                <Select
                  id="pbkdf-prf"
                  value={prf}
                  onChange={event => setPrf(event.target.value as PrfAlgorithm)}
                >
                  <option value="SHA1">PBKDF2-HMAC-SHA1</option>
                  <option value="SHA256">PBKDF2-HMAC-SHA256</option>
                  <option value="SHA512">PBKDF2-HMAC-SHA512</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <Label htmlFor="pbkdf-length">{t('app.hash.pbkdf.length')}</Label>
                <Select
                  id="pbkdf-length"
                  value={String(derivedLength)}
                  onChange={event => setDerivedLength(Number(event.target.value) as DerivedLength)}
                >
                  {DERIVED_LENGTHS.map(length => (
                    <option key={length} value={length}>
                      {t('app.hash.pbkdf.length_option', {
                        bytes: length,
                        bits: length * 8
                      })}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="pbkdf-iterations">{t('app.hash.pbkdf.iterations')}</Label>
                <Input
                  id="pbkdf-iterations"
                  type="number"
                  min={1}
                  max={MAX_ITERATIONS}
                  value={iterations}
                  onChange={event => setIterations(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="pbkdf-format">{t('app.hash.pbkdf.output_format')}</Label>
                <Select
                  id="pbkdf-format"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  <option value="hex">{t('app.hash.pbkdf.format.hex')}</option>
                  <option value="base64">{t('app.hash.pbkdf.format.base64')}</option>
                  <option value="json">{t('app.hash.pbkdf.format.json')}</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ITERATION_PRESETS.map(preset => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={iterations === preset ? 'primary' : 'default'}
                  onClick={() => setIterations(preset)}
                >
                  {numberFormatter.format(preset)}
                </Button>
              ))}
              <div className="glass-input rounded-xl px-3 py-2">
                <Checkbox
                  checked={uppercase}
                  disabled={outputFormat !== 'hex'}
                  onChange={event => setUppercase(event.target.checked)}
                  label={t('app.hash.text.uppercase')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-[600px] flex-col gap-5">
          <Card className="flex min-h-[300px] flex-1 flex-col">
            <CardHeader>
              <CardTitle className="text-base">{t('app.hash.result')}</CardTitle>
              <CardDescription>{t('app.hash.pbkdf.output_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4">
              {displayedOutput ? (
                <>
                  <Textarea
                    readOnly
                    rows={outputFormat === 'json' ? 10 : 6}
                    value={displayedOutput}
                    className="min-h-40 font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => copy(displayedOutput)}
                    >
                      {t('public.copy')}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      icon={<Download className="h-4 w-4" />}
                      onClick={() =>
                        downloadText(
                          displayedOutput,
                          outputFormat === 'json' ? 'pbkdf2.json' : `pbkdf2.${outputFormat}`,
                          outputFormat === 'json'
                            ? 'application/json;charset=utf-8'
                            : 'text/plain;charset=utf-8'
                        )
                      }
                    >
                      {t('app.hash.text.download')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-48 items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                  {t('app.hash.pbkdf.empty')}
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
              <CardDescription>{t('app.hash.pbkdf.verify_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={verifyDigest}
                onChange={event => setVerifyDigest(event.target.value)}
                placeholder={t('app.hash.target')}
                className="font-mono"
              />
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

export default PBKDFClient
