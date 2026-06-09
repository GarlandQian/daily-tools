'use client'

import {
  AlertTriangle,
  Copy,
  FileJson,
  FlaskConical,
  KeyRound,
  ShieldCheck,
  ShieldQuestion,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { useVisibleNow } from '@/hooks/useVisibleNow'

interface DecodedJwt {
  error: string | null
  header: Record<string, unknown> | null
  payload: Record<string, unknown> | null
  signature: string
}

interface JwtMetric {
  label: string
  tone?: 'error' | 'success' | 'warning'
  value: string
}

const MAX_JWT_INPUT_CHARS = 120000

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRhaWx5IFRvb2xzIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjQxMDI0NDQ4MDB9.4T0IduLk0QPU97v0LvZ8G9FHUnInlnc8oYgcH4ilp9c'

const textDecoder = new TextDecoder('utf-8', { fatal: true })

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/')
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

const decodeJsonPart = (part: string) => {
  const json = textDecoder.decode(base64UrlToBytes(part))
  return JSON.parse(json) as Record<string, unknown>
}

const formatJson = (obj: unknown) => {
  try {
    return JSON.stringify(obj ?? {}, null, 2)
  } catch {
    return String(obj ?? {})
  }
}

const formatDateTime = (timestampSeconds: unknown) => {
  if (typeof timestampSeconds !== 'number' || !Number.isFinite(timestampSeconds)) return null
  const date = new Date(timestampSeconds * 1000)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

const formatRelative = (targetMillis: number, nowMillis: number) => {
  const diffSeconds = Math.round((targetMillis - nowMillis) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const units = [
    { seconds: 86400, suffix: 'd' },
    { seconds: 3600, suffix: 'h' },
    { seconds: 60, suffix: 'm' },
    { seconds: 1, suffix: 's' }
  ]
  const unit = units.find(item => absSeconds >= item.seconds) ?? units[units.length - 1]
  const value = Math.max(0, Math.round(absSeconds / unit.seconds))
  return diffSeconds >= 0 ? `+${value}${unit.suffix}` : `-${value}${unit.suffix}`
}

const byteLength = (value: string) => new TextEncoder().encode(value).length

const decodeJwt = (value: string): DecodedJwt => {
  const token = value.trim()
  if (!token) {
    return { error: null, header: null, payload: null, signature: '' }
  }

  const parts = token.split('.')
  if (parts.length !== 3 || parts.some(part => part.length === 0)) {
    return {
      error: 'invalid_format',
      header: null,
      payload: null,
      signature: parts[2] ?? ''
    }
  }

  try {
    return {
      error: null,
      header: decodeJsonPart(parts[0]),
      payload: decodeJsonPart(parts[1]),
      signature: parts[2]
    }
  } catch {
    return {
      error: 'decode_failed',
      header: null,
      payload: null,
      signature: parts[2] ?? ''
    }
  }
}

export default function JwtClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [token, setToken] = useState('')
  const deferredToken = useDeferredValue(token)
  const safeToken = useMemo(() => deferredToken.slice(0, MAX_JWT_INPUT_CHARS), [deferredToken])

  const decoded = useMemo(() => decodeJwt(safeToken), [safeToken])
  const now = useVisibleNow(Boolean(decoded.payload?.exp || decoded.payload?.nbf))

  const headerJson = useMemo(() => formatJson(decoded.header), [decoded.header])
  const payloadJson = useMemo(() => formatJson(decoded.payload), [decoded.payload])
  const combinedJson = useMemo(
    () =>
      formatJson({
        header: decoded.header ?? {},
        payload: decoded.payload ?? {},
        signature: decoded.signature
      }),
    [decoded.header, decoded.payload, decoded.signature]
  )

  const metrics = useMemo<JwtMetric[]>(() => {
    const header = decoded.header ?? {}
    const payload = decoded.payload ?? {}
    const nowMillis = now
    const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : null
    const nbf = typeof payload.nbf === 'number' ? payload.nbf * 1000 : null
    const alg = typeof header.alg === 'string' ? header.alg : t('app.encryption.jwt.unknown')
    const typ = typeof header.typ === 'string' ? header.typ : t('app.encryption.jwt.unknown')

    const expValue = exp
      ? `${formatDateTime(payload.exp) ?? '-'} (${formatRelative(exp, nowMillis)})`
      : t('app.encryption.jwt.none')
    const nbfValue = nbf
      ? `${formatDateTime(payload.nbf) ?? '-'} (${formatRelative(nbf, nowMillis)})`
      : t('app.encryption.jwt.none')

    return [
      { label: t('app.encryption.jwt.stats.alg'), value: alg },
      { label: t('app.encryption.jwt.stats.typ'), value: typ },
      {
        label: t('app.encryption.jwt.stats.exp'),
        tone: exp && nowMillis >= exp ? 'error' : exp ? 'success' : undefined,
        value: expValue
      },
      {
        label: t('app.encryption.jwt.stats.nbf'),
        tone: nbf && nowMillis < nbf ? 'warning' : nbf ? 'success' : undefined,
        value: nbfValue
      },
      {
        label: t('app.encryption.jwt.stats.claims'),
        value: String(Object.keys(payload).length)
      },
      {
        label: t('app.encryption.jwt.stats.signature'),
        value: decoded.signature
          ? t('app.encryption.jwt.signature_present')
          : t('app.encryption.jwt.signature_missing'),
        tone: decoded.signature ? undefined : 'warning'
      }
    ]
  }, [decoded.header, decoded.payload, decoded.signature, now, t])

  const status = useMemo(() => {
    if (!safeToken.trim()) return null
    if (decoded.error) {
      return {
        icon: AlertTriangle,
        tone: 'error' as const,
        text: t(`app.encryption.jwt.error.${decoded.error}`)
      }
    }

    const exp = typeof decoded.payload?.exp === 'number' ? decoded.payload.exp * 1000 : null
    const nbf = typeof decoded.payload?.nbf === 'number' ? decoded.payload.nbf * 1000 : null
    const nowMillis = now

    if (exp && nowMillis >= exp) {
      return { icon: ShieldCheck, tone: 'error' as const, text: t('app.encryption.jwt.expired') }
    }
    if (nbf && nowMillis < nbf) {
      return {
        icon: ShieldQuestion,
        tone: 'warning' as const,
        text: t('app.encryption.jwt.not_before')
      }
    }
    return { icon: ShieldCheck, tone: 'success' as const, text: t('app.encryption.jwt.valid') }
  }, [decoded.error, decoded.payload, now, safeToken, t])

  const tokenParts = useMemo(() => {
    const [header = '', payload = '', signature = ''] = safeToken.trim().split('.')
    return [
      { label: t('app.encryption.jwt.header'), value: header },
      { label: t('app.encryption.jwt.payload'), value: payload },
      { label: t('app.encryption.jwt.signature'), value: signature }
    ]
  }, [safeToken, t])

  const warning =
    deferredToken.length > MAX_JWT_INPUT_CHARS
      ? t('app.encryption.jwt.warning.truncated', { count: MAX_JWT_INPUT_CHARS })
      : null

  const loadSample = useCallback(() => {
    setToken(SAMPLE_JWT)
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[var(--primary)]" />
                {t('app.encryption.jwt')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.encryption.jwt.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={loadSample}
              >
                {t('app.encryption.jwt.sample')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setToken('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label htmlFor="jwt-token">{t('app.encryption.jwt.input')}</Label>
            <Textarea
              id="jwt-token"
              value={token}
              onChange={event => setToken(event.target.value)}
              placeholder={t('app.encryption.jwt.placeholder')}
              rows={5}
              className="resize-none font-mono"
            />
          </div>

          {status && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                status.tone === 'error'
                  ? 'border-[var(--error)] bg-[var(--error-subtle)] text-[var(--error)]'
                  : status.tone === 'warning'
                    ? 'border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]'
                    : 'border-[var(--success)] bg-[var(--success-subtle)] text-[var(--success)]'
              }`}
            >
              <status.icon className="h-4 w-4 shrink-0" />
              {status.text}
            </div>
          )}

          {warning && (
            <p className="rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}

          {decoded.header && decoded.payload && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metrics.map(metric => (
                <JwtMetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          )}

          <p className="rounded-xl border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {t('app.encryption.jwt.unverified_hint')}
          </p>
        </CardContent>
      </Card>

      {decoded.header && decoded.payload && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <JwtJsonCard
              copyLabel={t('public.copy')}
              title={t('app.encryption.jwt.header')}
              value={headerJson}
              onCopy={() => copy(headerJson)}
            />
            <JwtJsonCard
              copyLabel={t('public.copy')}
              title={t('app.encryption.jwt.payload')}
              value={payloadJson}
              onCopy={() => copy(payloadJson)}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileJson className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.encryption.jwt.parts')}
                </CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => copy(combinedJson)}
                >
                  {t('app.encryption.jwt.copy_all_json')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tokenParts.map(part => (
                <div key={part.label} className="glass-input rounded-xl p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {part.label}
                    </span>
                    <span className="text-xs tabular-nums text-[var(--text-tertiary)]">
                      {byteLength(part.value)} B
                    </span>
                  </div>
                  <p className="break-all font-mono text-xs text-[var(--text-primary)]">
                    {part.value || '-'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

const JwtMetricCard = ({ metric }: { metric: JwtMetric }) => {
  const toneClass =
    metric.tone === 'error'
      ? 'text-[var(--error)]'
      : metric.tone === 'warning'
        ? 'text-[var(--warning)]'
        : metric.tone === 'success'
          ? 'text-[var(--success)]'
          : 'text-[var(--text-primary)]'

  return (
    <div className="glass-input rounded-xl p-3">
      <div className="text-xs text-[var(--text-secondary)]">{metric.label}</div>
      <div className={`mt-1 break-words text-sm font-semibold tabular-nums ${toneClass}`}>
        {metric.value}
      </div>
    </div>
  )
}

const JwtJsonCard = ({
  copyLabel,
  onCopy,
  title,
  value
}: {
  copyLabel: string
  onCopy: () => void
  title: string
  value: string
}) => (
  <Card className="flex min-h-[360px] flex-col">
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={<Copy className="h-4 w-4" />}
          onClick={onCopy}
        >
          {copyLabel}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <Textarea
        value={value}
        readOnly
        rows={14}
        className="min-h-[280px] flex-1 resize-none font-mono"
      />
    </CardContent>
  </Card>
)
