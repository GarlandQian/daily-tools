'use client'

import {
  Copy,
  Download,
  FileJson,
  Globe,
  Link,
  ListChecks,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { collectBoundedNonEmptyLines } from '@/utils/textScan'

interface QueryParam {
  key: string
  value: string
  id: string
}

interface ParsedUrlParts {
  hitParamLimit: boolean
  normalized: string
  params: QueryParam[]
  url: URL
}

interface BatchUrlResult {
  error: string
  host: string
  input: string
  normalized: string
  pathDepth: number
  queryCount: number
  status: 'ok' | 'error'
}

const MAX_URL_INPUT_CHARS = 200000
const MAX_URL_QUERY_PARAMS = 500
const MAX_URL_RENDERED_QUERY_PARAMS = 160
const MAX_URL_BATCH_LINES = 80
const MAX_URL_BATCH_CHARS = 100000
const MAX_URL_HOST_CHARS = 253
const MAX_URL_PATH_CHARS = 4096
const MAX_URL_HASH_CHARS = 1024
const MAX_URL_PARAM_CHARS = 1024
const MAX_URL_BATCH_LINE_CHARS = 4096
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id']
const urlNumberFormatter = new Intl.NumberFormat()

const formatUrlNumber = (value: number) => urlNumberFormatter.format(value)
const makeParamId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
const capUrlParam = (param: QueryParam): QueryParam => ({
  ...param,
  key: param.key.slice(0, MAX_URL_PARAM_CHARS),
  value: param.value.slice(0, MAX_URL_PARAM_CHARS)
})

const SAMPLE_URLS = {
  api: 'https://api.example.com/v1/search?q=daily%20tools&page=2&sort=recent#results',
  campaign:
    'https://daily.tools/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=summer_launch&utm_content=hero_cta&plan=pro',
  deepLink: 'daily.tools/tools/format/url?tab=query&debug=true'
} as const

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

const parseUrlParts = (value: string): ParsedUrlParts => {
  const url = new URL(normalizeUrlInput(value))
  const params: QueryParam[] = []
  let hitParamLimit = false

  for (const [key, paramValue] of url.searchParams) {
    if (params.length >= MAX_URL_QUERY_PARAMS) {
      hitParamLimit = true
      break
    }
    params.push(capUrlParam({ key, value: paramValue, id: makeParamId() }))
  }

  return {
    hitParamLimit,
    normalized: url.toString(),
    params,
    url
  }
}

const getHostKind = (hostname: string) => {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return 'local'
  if (/^(127|10)\./.test(host)) return 'private'
  if (/^192\.168\./.test(host)) return 'private'
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 'private'
  if (/^\[[a-f\d:]+\]$/i.test(host) || /^[a-f\d:]+$/i.test(host)) return 'ipv6'
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'ipv4'
  return 'public'
}

const getDuplicateParamCount = (params: QueryParam[]) => {
  const counts = new Map<string, number>()

  params.forEach(param => {
    if (!param.key) return
    counts.set(param.key, (counts.get(param.key) ?? 0) + 1)
  })

  return [...counts.values()].filter(count => count > 1).length
}

const buildQueryData = (params: QueryParam[]) => {
  const record: Record<string, string | string[]> = {}
  let validCount = 0

  params.forEach(param => {
    if (!param.key) return

    validCount += 1
    const current = record[param.key]
    if (Array.isArray(current)) {
      current.push(param.value)
    } else if (current !== undefined) {
      record[param.key] = [current, param.value]
    } else {
      record[param.key] = param.value
    }
  })

  return {
    json: JSON.stringify(record, null, 2),
    validCount
  }
}

const buildBatchResults = (input: string): BatchUrlResult[] =>
  collectBoundedNonEmptyLines(input, MAX_URL_BATCH_LINES).lines.map(line => {
    const safeLine = line.slice(0, MAX_URL_BATCH_LINE_CHARS)

    try {
      const url = new URL(normalizeUrlInput(safeLine))
      return {
        error: '',
        host: url.host,
        input: safeLine,
        normalized: url.toString(),
        pathDepth: url.pathname.split('/').filter(Boolean).length,
        queryCount: [...url.searchParams].length,
        status: 'ok' as const
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        host: '',
        input: safeLine,
        normalized: '',
        pathDepth: 0,
        queryCount: 0,
        status: 'error' as const
      }
    }
  })

const buildBatchExport = (
  batchRows: BatchUrlResult[],
  batchStats: { errors: number; hosts: number; total: number; valid: number }
) =>
  JSON.stringify(
    {
      results: batchRows,
      stats: batchStats
    },
    null,
    2
  )

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const UrlClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [inputUrl, setInputUrl] = useState('')
  const [isInputUrlCapped, setIsInputUrlCapped] = useState(false)
  const [protocol, setProtocol] = useState('https:')
  const [host, setHost] = useState('')
  const [pathname, setPathname] = useState('')
  const [hash, setHash] = useState('')
  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [batchInput, setBatchInput] = useState('')
  const [isBatchInputCapped, setIsBatchInputCapped] = useState(false)
  const deferredBatchInput = useDeferredValue(batchInput)
  const safeBatchInput = useMemo(
    () =>
      deferredBatchInput.length > MAX_URL_BATCH_CHARS
        ? deferredBatchInput.slice(0, MAX_URL_BATCH_CHARS)
        : deferredBatchInput,
    [deferredBatchInput]
  )

  const updateInputUrl = useCallback((value: string) => {
    const capped = value.length > MAX_URL_INPUT_CHARS
    setIsInputUrlCapped(capped)
    setInputUrl(capped ? value.slice(0, MAX_URL_INPUT_CHARS) : value)
  }, [])

  const applyParsedValue = useCallback(
    (value: string) => {
      try {
        const { hitParamLimit, normalized, params, url } = parseUrlParts(value)
        setProtocol(url.protocol)
        setHost(url.host.slice(0, MAX_URL_HOST_CHARS))
        setPathname(url.pathname.slice(0, MAX_URL_PATH_CHARS))
        setHash(url.hash.slice(0, MAX_URL_HASH_CHARS))
        updateInputUrl(normalized)
        setQueryParams(params.map(capUrlParam))
        setError(null)
        setWarning(
          hitParamLimit
            ? t('app.format.url.warning.too_many_params', {
                limit: formatUrlNumber(MAX_URL_QUERY_PARAMS)
              })
            : null
        )
      } catch {
        setError(t('app.converter.base.invalid'))
        setWarning(null)
      }
    },
    [t, updateInputUrl]
  )

  const handleParse = useCallback(() => {
    if (!inputUrl.trim()) return

    if (isInputUrlCapped || inputUrl.length > MAX_URL_INPUT_CHARS) {
      setError(null)
      setWarning(
        t('app.format.url.warning.too_large', {
          limit: formatUrlNumber(MAX_URL_INPUT_CHARS)
        })
      )
      return
    }

    applyParsedValue(inputUrl)
  }, [applyParsedValue, inputUrl, isInputUrlCapped, t])

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

  const queryData = useMemo(() => buildQueryData(queryParams), [queryParams])
  const queryJson = queryData.json
  const visibleQueryParams = useMemo(
    () => queryParams.slice(0, MAX_URL_RENDERED_QUERY_PARAMS),
    [queryParams]
  )
  const isQueryParamRenderLimited = queryParams.length > visibleQueryParams.length
  const batchRows = useMemo(() => buildBatchResults(safeBatchInput), [safeBatchInput])
  const batchStats = useMemo(
    () => ({
      errors: batchRows.filter(row => row.status === 'error').length,
      hosts: new Set(batchRows.filter(row => row.host).map(row => row.host)).size,
      total: batchRows.length,
      valid: batchRows.filter(row => row.status === 'ok').length
    }),
    [batchRows]
  )

  const urlSummary = useMemo(() => {
    if (!constructedUrl) return null

    try {
      const url = new URL(constructedUrl)
      const utm = UTM_KEYS.map(key => [key, url.searchParams.get(key)] as const).filter(
        ([, value]) => Boolean(value)
      )
      return {
        duplicateParams: getDuplicateParamCount(queryParams),
        encodedLength: constructedUrl.length,
        hostKind: getHostKind(url.hostname),
        hasCredentials: Boolean(url.username || url.password),
        origin: url.origin,
        protocol: url.protocol,
        queryCount: queryData.validCount,
        pathDepth: url.pathname.split('/').filter(Boolean).length,
        hasHash: Boolean(url.hash),
        utm
      }
    } catch {
      return null
    }
  }, [constructedUrl, queryData.validCount, queryParams])

  const exportSummary = useMemo(() => {
    if (!constructedUrl || !urlSummary) return ''

    return JSON.stringify(
      {
        decodedUrl,
        query: JSON.parse(queryJson || '{}') as unknown,
        summary: urlSummary,
        url: constructedUrl
      },
      null,
      2
    )
  }, [constructedUrl, decodedUrl, queryJson, urlSummary])

  const handleParamChange = (id: string, field: 'key' | 'value', value: string) => {
    setQueryParams(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value.slice(0, MAX_URL_PARAM_CHARS) } : p))
    )
  }

  const updateBatchInput = (value: string) => {
    const capped = value.length > MAX_URL_BATCH_CHARS
    setIsBatchInputCapped(capped)
    setBatchInput(capped ? value.slice(0, MAX_URL_BATCH_CHARS) : value)
  }

  const handleAddParam = () => {
    if (queryParams.length >= MAX_URL_QUERY_PARAMS) {
      setWarning(
        t('app.format.url.warning.too_many_params', {
          limit: formatUrlNumber(MAX_URL_QUERY_PARAMS)
        })
      )
      return
    }

    setWarning(null)
    setQueryParams(prev => [...prev, { key: '', value: '', id: makeParamId() }])
  }

  const handleDeleteParam = (id: string) => {
    setWarning(null)
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

  const handleParseSample = (sample: keyof typeof SAMPLE_URLS) => {
    const value = SAMPLE_URLS[sample]
    applyParsedValue(value)
  }

  const handleFromCurrentPage = () => {
    if (typeof window !== 'undefined') {
      updateInputUrl(window.location.href)
    }
  }

  const handleClear = () => {
    updateInputUrl('')
    setProtocol('https:')
    setHost('')
    setPathname('')
    setHash('')
    setQueryParams([])
    setError(null)
    setWarning(null)
    updateBatchInput('')
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
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => handleParseSample('campaign')}
              >
                {t('app.format.url.sample_campaign')}
              </Button>
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
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Textarea
              value={inputUrl}
              onChange={e => updateInputUrl(e.target.value)}
              placeholder={t('app.format.url.placeholder')}
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
          <div className="flex flex-wrap gap-2">
            {(['api', 'campaign', 'deepLink'] as const).map(sample => (
              <Button
                key={sample}
                size="sm"
                variant="outline"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleParseSample(sample)}
              >
                {t(`app.format.url.sample.${sample}`)}
              </Button>
            ))}
          </div>
          {error && <span className="text-[var(--error)] text-sm mt-2 block">{error}</span>}
          {warning && (
            <p className="mt-2 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}
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
                  onChange={e => setHost(e.target.value.slice(0, MAX_URL_HOST_CHARS))}
                  placeholder="example.com"
                  maxLength={MAX_URL_HOST_CHARS}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.path')}
                </Label>
                <Input
                  value={pathname}
                  onChange={e => setPathname(e.target.value.slice(0, MAX_URL_PATH_CHARS))}
                  placeholder="/path"
                  maxLength={MAX_URL_PATH_CHARS}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.url.hash')}
                </Label>
                <Input
                  value={hash}
                  onChange={e => setHash(e.target.value.slice(0, MAX_URL_HASH_CHARS))}
                  placeholder="#section"
                  maxLength={MAX_URL_HASH_CHARS}
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
              {visibleQueryParams.map(param => (
                <div key={param.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    value={param.key}
                    onChange={e => handleParamChange(param.id, 'key', e.target.value)}
                    placeholder={t('app.format.url.key')}
                    maxLength={MAX_URL_PARAM_CHARS}
                    className="flex-1"
                  />
                  <Input
                    value={param.value}
                    onChange={e => handleParamChange(param.id, 'value', e.target.value)}
                    placeholder={t('app.format.url.value')}
                    maxLength={MAX_URL_PARAM_CHARS}
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
              {isQueryParamRenderLimited && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.format.url.warning.too_many_params', {
                    limit: formatUrlNumber(MAX_URL_RENDERED_QUERY_PARAMS)
                  })}
                </p>
              )}
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
              <Button
                size="sm"
                variant="outline"
                icon={<FileJson className="w-4 h-4" />}
                onClick={() => void copy(exportSummary)}
                disabled={!exportSummary}
              >
                JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="w-4 h-4" />}
                onClick={() =>
                  downloadText(
                    exportSummary,
                    'daily-tools-url.json',
                    'application/json;charset=utf-8'
                  )
                }
                disabled={!exportSummary}
              >
                {t('app.format.url.download')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {urlSummary && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <UrlMetric label={t('app.format.url.origin')} value={urlSummary.origin} />
              <UrlMetric label={t('app.format.url.protocol')} value={urlSummary.protocol} />
              <UrlMetric
                label={t('app.format.url.host_type')}
                value={t(`app.format.url.host_type.${urlSummary.hostKind}`)}
              />
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
              <UrlMetric
                label={t('app.format.url.duplicate_params')}
                value={String(urlSummary.duplicateParams)}
              />
              <UrlMetric
                label={t('app.format.url.credentials')}
                value={urlSummary.hasCredentials ? t('public.yes') : t('public.no')}
              />
              <UrlMetric
                label={t('app.format.url.length')}
                value={formatUrlNumber(urlSummary.encodedLength)}
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
          {urlSummary && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.format.url.diagnostics')}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <UrlBadge
                    active={urlSummary.protocol === 'https:'}
                    label={t('app.format.url.diagnostic.https')}
                  />
                  <UrlBadge
                    active={urlSummary.queryCount > 0}
                    label={t('app.format.url.diagnostic.query')}
                  />
                  <UrlBadge
                    active={urlSummary.hasHash}
                    label={t('app.format.url.diagnostic.hash')}
                  />
                  <UrlBadge
                    active={urlSummary.duplicateParams > 0}
                    label={t('app.format.url.diagnostic.duplicates')}
                  />
                  <UrlBadge
                    active={urlSummary.hasCredentials}
                    label={t('app.format.url.diagnostic.credentials')}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
                <div className="text-xs font-semibold text-[var(--text-tertiary)]">
                  {t('app.format.url.utm')}
                </div>
                {urlSummary.utm.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {urlSummary.utm.map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => value && void copy(value)}
                        className="rounded-full bg-[var(--primary-subtle)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--primary)]"
                      >
                        {key}={value}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {t('app.format.url.utm_empty')}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.url.batch')}
              </CardTitle>
              <CardDescription>
                {t('app.format.url.batch_hint', { limit: formatUrlNumber(MAX_URL_BATCH_LINES) })}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateBatchInput(
                    [SAMPLE_URLS.api, SAMPLE_URLS.campaign, SAMPLE_URLS.deepLink].join('\n')
                  )
                }
              >
                {t('app.format.url.sample_batch')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Copy className="h-4 w-4" />}
                disabled={!batchRows.length}
                onClick={() => void copy(buildBatchExport(batchRows, batchStats))}
              >
                JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                disabled={!batchRows.length}
                onClick={() =>
                  downloadText(
                    buildBatchExport(batchRows, batchStats),
                    'daily-tools-url-batch.json',
                    'application/json;charset=utf-8'
                  )
                }
              >
                {t('app.format.url.download')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={batchInput}
            onChange={event => updateBatchInput(event.target.value)}
            placeholder={t('app.format.url.batch_placeholder')}
            rows={4}
            className="font-mono"
          />
          {(isBatchInputCapped || deferredBatchInput.length > MAX_URL_BATCH_CHARS) && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.url.warning.batch_too_large', {
                limit: formatUrlNumber(MAX_URL_BATCH_CHARS)
              })}
            </p>
          )}
          {batchRows.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <UrlMetric label={t('app.format.url.batch_total')} value={String(batchStats.total)} />
              <UrlMetric label={t('app.format.url.batch_valid')} value={String(batchStats.valid)} />
              <UrlMetric
                label={t('app.format.url.batch_errors')}
                value={String(batchStats.errors)}
              />
              <UrlMetric label={t('app.format.url.batch_hosts')} value={String(batchStats.hosts)} />
            </div>
          )}
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {batchRows.map(row => (
              <button
                key={`${row.input}-${row.normalized || row.error}`}
                type="button"
                onClick={() => {
                  if (row.status === 'ok') {
                    applyParsedValue(row.normalized)
                  }
                }}
                className="grid w-full min-w-0 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2 text-left md:grid-cols-[88px_minmax(0,0.55fr)_minmax(0,0.45fr)] md:items-center"
              >
                <span
                  className={
                    row.status === 'ok'
                      ? 'w-fit rounded-full bg-[var(--success-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]'
                      : 'w-fit rounded-full bg-[var(--error-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--error)]'
                  }
                >
                  {row.status === 'ok' ? t('app.format.url.valid') : t('app.format.url.invalid')}
                </span>
                <span className="truncate font-mono text-xs text-[var(--text-primary)]">
                  {row.normalized || row.input}
                </span>
                <span className="truncate text-xs text-[var(--text-tertiary)]">
                  {row.status === 'ok'
                    ? `${row.host} · ${row.queryCount} ${t('app.format.url.params_short')}`
                    : row.error}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const UrlBadge = ({ active, label }: { active: boolean; label: string }) => (
  <span
    className={
      active
        ? 'rounded-full bg-[var(--primary-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]'
        : 'rounded-full bg-[var(--glass-input-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)]'
    }
  >
    {label}
  </span>
)

const UrlMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default UrlClient
