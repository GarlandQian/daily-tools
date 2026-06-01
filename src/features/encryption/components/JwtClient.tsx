'use client'

import { jwtDecode } from 'jwt-decode'
import { ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface JwtPayload {
  [key: string]: unknown
}

interface DecodedResult {
  decoded: { header: unknown; payload: JwtPayload } | null
  error: string | null
  expTimestamp: number | null
}

const JwtClient = () => {
  const { t } = useTranslation()

  const [token, setToken] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // Tick every second so expiration status stays current after the user pastes a token
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const { decoded, error, expTimestamp }: DecodedResult = useMemo(() => {
    if (!token.trim()) {
      return { decoded: null, error: null, expTimestamp: null }
    }

    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return {
          decoded: null,
          error: t('app.encryption.jwt.invalid_format'),
          expTimestamp: null
        }
      }

      const header = JSON.parse(atob(parts[0]))
      const payload = jwtDecode<JwtPayload>(token)

      const expTs = payload.exp ? (payload.exp as number) * 1000 : null

      return { decoded: { header, payload }, error: null, expTimestamp: expTs }
    } catch (e) {
      const err = e as Error
      return { decoded: null, error: err.message, expTimestamp: null }
    }
  }, [token, t])

  const isExpired = useMemo(() => {
    if (expTimestamp === null) return null
    return now >= expTimestamp
  }, [expTimestamp, now])

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToken(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setToken('')
  }, [])

  const formatJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('app.encryption.jwt')}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            icon={<X className="w-4 h-4" />}
          >
            {t('app.format.json.clear')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={token}
            onChange={handleTokenChange}
            placeholder={t('app.encryption.jwt.placeholder')}
            rows={4}
            className="font-mono"
          />
          {error && (
            <p className="text-sm" style={{ color: 'var(--error)' }}>
              {t('app.format.json.error')}: {error}
            </p>
          )}
          {isExpired !== null && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck
                className="w-4 h-4"
                style={{ color: isExpired ? 'var(--error)' : 'var(--success)' }}
              />
              <span style={{ color: isExpired ? 'var(--error)' : 'var(--success)' }}>
                {isExpired ? t('app.encryption.jwt.expired') : t('app.encryption.jwt.valid')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{t('app.encryption.jwt.header')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <pre
              className="glass-input rounded-lg p-3 font-mono text-[13px] m-0 whitespace-pre-wrap break-all"
              style={{ color: 'var(--text-primary)' }}
            >
              {decoded ? formatJson(decoded.header) : '{}'}
            </pre>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{t('app.encryption.jwt.payload')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <pre
              className="glass-input rounded-lg p-3 font-mono text-[13px] m-0 whitespace-pre-wrap break-all"
              style={{ color: 'var(--text-primary)' }}
            >
              {decoded ? formatJson(decoded.payload) : '{}'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default JwtClient
