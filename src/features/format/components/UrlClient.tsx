'use client'

import { Copy, Globe, Link, Plus, RotateCcw, Trash2 } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface QueryParam {
  key: string
  value: string
  id: string
}

const makeParamId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

const normalizeUrlInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return `https://${trimmed}`
}

const decodeUrlSafely = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const toQueryJson = (params: QueryParam[]) => {
  const record: Record<string, string | string[]> = {}

  params.forEach(param => {
    if (!param.key) return

    const current = record[param.key]
    if (Array.isArray(current)) {
      current.push(param.value)
    } else if (current !== undefined) {
      record[param.key] = [current, param.value]
    } else {
      record[param.key] = param.value
    }
  })

  return JSON.stringify(record, null, 2)
}

const UrlClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [inputUrl, setInputUrl] = useState('')
  const [protocol, setProtocol] = useState('https:')
  const [host, setHost] = useState('')
  const [pathname, setPathname] = useState('')
  const [hash, setHash] = useState('')
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleParse = useCallback(() => {
    if (!inputUrl.trim()) return

    try {
      const url = new URL(normalizeUrlInput(inputUrl))
      setProtocol(url.protocol)
      setHost(url.host)
      setPathname(url.pathname)
      setHash(url.hash)
      setInputUrl(url.toString())

      const params: QueryParam[] = []
      url.searchParams.forEach((value, key) => {
        params.push({ key, value, id: makeParamId() })
      })
      setQueryParams(params)
      setError(null)
    } catch {
      setError(t('app.converter.base.invalid'))
    }
  }, [inputUrl, t])

  // Reconstruct URL from components
  const constructedUrl = useMemo(() => {
    try {
      if (!host) return ''

      // Dummy base to construct from
      const url = new URL('https://example.com')
      url.protocol = protocol
      url.host = host
      url.pathname = pathname
      url.hash = hash

      url.search = ''
      queryParams.forEach(p => {
        if (p.key) url.searchParams.append(p.key, p.value)
      })

      return url.toString()
    } catch {
      return ''
    }
  }, [protocol, host, pathname, hash, queryParams])

  const decodedUrl = useMemo(() => {
    if (!constructedUrl) return ''
    return decodeUrlSafely(constructedUrl)
  }, [constructedUrl])

  const queryJson = useMemo(() => toQueryJson(queryParams), [queryParams])

  const urlSummary = useMemo(() => {
    if (!constructedUrl) return null

    try {
      const url = new URL(constructedUrl)
      return {
        origin: url.origin,
        queryCount: queryParams.filter(param => param.key).length,
        pathDepth: url.pathname.split('/').filter(Boolean).length,
        hasHash: Boolean(url.hash)
      }
    } catch {
      return null
    }
  }, [constructedUrl, queryParams])

  const handleParamChange = (id: string, field: 'key' | 'value', value: string) => {
    setQueryParams(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleAddParam = () => {
    setQueryParams(prev => [...prev, { key: '', value: '', id: makeParamId() }])
  }

  const handleDeleteParam = (id: string) => {
    setQueryParams(prev => prev.filter(p => p.id !== id))
  }

  const handleSortParams = () => {
    setQueryParams(prev =>
      [...prev].sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value))
    )
  }

  const handleCopyCurl = () => {
    if (!constructedUrl) return
    void copy(`curl ${JSON.stringify(constructedUrl)}`)
  }

  const handleFromCurrentPage = () => {
    if (typeof window !== 'undefined') {
      setInputUrl(window.location.href)
    }
  }

  const handleClear = () => {
    setInputUrl('')
    setProtocol('https:')
    setHost('')
    setPathname('')
    setHash('')
    setQueryParams([])
    setError(null)
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5 text-[var(--primary)]" />
                {t('app.format.url')}
              </CardTitle>
              <CardDescription>{t('app.format.url.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                icon={<Globe className="w-4 h-4" />}
                onClick={handleFromCurrentPage}
              >
                {t('app.format.url.current_page')}
              </Button>
              <Button size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Textarea
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="example.com/path?query=123"
              rows={2}
              className="flex-1 font-mono resize-none"
            />
            <Button
              variant="primary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleParse}
              className="w-full sm:w-auto"
            >
              {t('app.format.url.parse')}
            </Button>
          </div>
          {error && <span className="text-[var(--error)] text-sm mt-2 block">{error}</span>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('app.format.url.components')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5">
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.protocol')}
                </Label>
                <Select value={protocol} onChange={e => setProtocol(e.target.value)}>
                  <option value="http:">http://</option>
                  <option value="https:">https://</option>
                  <option value="ftp:">ftp://</option>
                  <option value="ws:">ws://</option>
                  <option value="wss:">wss://</option>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.host')}
                </Label>
                <Input
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.path')}
                </Label>
                <Input
                  value={pathname}
                  onChange={e => setPathname(e.target.value)}
                  placeholder="/path"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.hash')}
                </Label>
                <Input
                  value={hash}
                  onChange={e => setHash(e.target.value)}
                  placeholder="#section"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{t('app.format.url.query_params')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSortParams}
                  disabled={!queryParams.length}
                >
                  {t('app.format.url.sort_query')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => void copy(queryJson)}
                  disabled={!queryParams.length}
                >
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleAddParam}
                >
                  {t('public.add')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto">
              {queryParams.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  {t('app.format.url.no_query_params')}
                </p>
              )}
              {queryParams.map(param => (
                <div key={param.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    value={param.key}
                    onChange={e => handleParamChange(param.id, 'key', e.target.value)}
                    placeholder={t('app.format.url.key')}
                    className="flex-1"
                  />
                  <Input
                    value={param.value}
                    onChange={e => handleParamChange(param.id, 'value', e.target.value)}
                    placeholder={t('app.format.url.value')}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteParam(param.id)}
                    className="text-[var(--error)] shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.format.url.constructed')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Copy className="w-4 h-4" />}
                onClick={() => void copy(constructedUrl)}
                disabled={!constructedUrl}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copy(decodedUrl)}
                disabled={!decodedUrl}
              >
                {t('app.format.url.copy_decoded')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyCurl}
                disabled={!constructedUrl}
              >
                cURL
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {urlSummary && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <UrlMetric label={t('app.format.url.origin')} value={urlSummary.origin} />
              <UrlMetric
                label={t('app.format.url.query_count')}
                value={String(urlSummary.queryCount)}
              />
              <UrlMetric
                label={t('app.format.url.path_depth')}
                value={String(urlSummary.pathDepth)}
              />
              <UrlMetric
                label={t('app.format.url.has_hash')}
                value={urlSummary.hasHash ? t('public.yes') : t('public.no')}
              />
            </div>
          )}
          <div className="glass-input rounded-lg p-3 font-mono text-sm break-all">
            {constructedUrl || (
              <span className="text-[var(--text-tertiary)]">{t('app.format.url.waiting')}</span>
            )}
          </div>
          {decodedUrl && decodedUrl !== constructedUrl && (
            <div className="glass-panel glass-clip rounded-lg p-3">
              <div className="text-xs font-medium text-[var(--text-tertiary)]">
                {t('app.format.url.decoded')}
              </div>
              <div className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {decodedUrl}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const UrlMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default UrlClient
