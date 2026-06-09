'use client'

import {
  ClipboardList,
  Copy,
  Download,
  FileCode2,
  FileJson,
  GitCompare,
  ListChecks,
  Search,
  ServerCrash,
  Sparkles
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const STATUS_FAMILIES = ['1xx', '2xx', '3xx', '4xx', '5xx'] as const
const STATUS_CLASSES = ['all', ...STATUS_FAMILIES] as const
const SNIPPET_TYPES = ['json', 'problem', 'headers', 'curl', 'next', 'express'] as const
const COMMON_CODES = [
  200, 201, 204, 301, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504
]
const BATCH_INPUT_LIMIT = 24000
const BATCH_CODE_LIMIT = 240
const COMPARE_LIMIT = 4

type StatusFamily = (typeof STATUS_FAMILIES)[number]
type StatusClass = (typeof STATUS_CLASSES)[number]
type SnippetType = (typeof SNIPPET_TYPES)[number]
type ScenarioKey = 'healthy' | 'auth' | 'rate_limit' | 'redirect' | 'validation' | 'outage'
type StatusSignal =
  | 'auth_header'
  | 'cacheable'
  | 'location'
  | 'problem_json'
  | 'retry_after'
  | 'retry_plan'
  | 'server_side'

interface StatusInfo {
  cache: string
  code: number
  description: string
  headers: string[]
  method: string
  name: string
  retry: string
  tags: string[]
}

interface ScenarioPreset {
  codes: number[]
  filter: StatusClass
  key: ScenarioKey
  query: string
  sample: string
}

interface BatchStatusRow {
  cache: string
  className: StatusFamily
  code: number
  count: number
  known: boolean
  name: string
  retry: string
}

interface BatchAnalysis {
  cacheable: number
  capped: boolean
  classCounts: Record<StatusFamily, number>
  exportCsv: string
  exportJson: string
  known: number
  retryable: number
  rows: BatchStatusRow[]
  total: number
  unknown: number
  unique: number
}

const STATUSES: StatusInfo[] = [
  {
    code: 100,
    name: 'Continue',
    description: 'Interim response. Continue sending the request body.',
    method: 'Upload flows',
    cache: 'No',
    retry: 'Continue',
    headers: ['Expect: 100-continue'],
    tags: ['upload', 'interim']
  },
  {
    code: 101,
    name: 'Switching Protocols',
    description: 'Server agrees to switch protocols, commonly for WebSocket upgrades.',
    method: 'GET',
    cache: 'No',
    retry: 'No',
    headers: ['Upgrade: websocket', 'Connection: Upgrade'],
    tags: ['websocket', 'upgrade']
  },
  {
    code: 200,
    name: 'OK',
    description: 'Request succeeded and returned a normal response body.',
    method: 'GET, PUT',
    cache: 'Often',
    retry: 'No',
    headers: ['Content-Type: application/json', 'Cache-Control: max-age=60'],
    tags: ['success', 'json']
  },
  {
    code: 201,
    name: 'Created',
    description: 'Resource was created successfully.',
    method: 'POST',
    cache: 'No',
    retry: 'No',
    headers: ['Location: /resources/123'],
    tags: ['success', 'create']
  },
  {
    code: 202,
    name: 'Accepted',
    description: 'Request accepted for asynchronous processing.',
    method: 'POST, PATCH',
    cache: 'No',
    retry: 'Poll status',
    headers: ['Location: /jobs/123', 'Retry-After: 10'],
    tags: ['async', 'job']
  },
  {
    code: 203,
    name: 'Non-Authoritative Information',
    description: 'Response metadata was transformed by an intermediary.',
    method: 'GET',
    cache: 'Sometimes',
    retry: 'No',
    headers: ['Warning: 214 Transformation Applied'],
    tags: ['proxy', 'metadata']
  },
  {
    code: 204,
    name: 'No Content',
    description: 'Request succeeded with no response body.',
    method: 'DELETE, PATCH',
    cache: 'No',
    retry: 'No',
    headers: [],
    tags: ['success', 'empty']
  },
  {
    code: 205,
    name: 'Reset Content',
    description: 'Request succeeded and the client should reset its document view.',
    method: 'POST, PUT',
    cache: 'No',
    retry: 'No',
    headers: ['Content-Length: 0'],
    tags: ['form', 'reset']
  },
  {
    code: 206,
    name: 'Partial Content',
    description: 'Server returned the requested byte range.',
    method: 'GET',
    cache: 'Yes',
    retry: 'Continue ranges',
    headers: ['Content-Range: bytes 0-1023/4096'],
    tags: ['range', 'download']
  },
  {
    code: 207,
    name: 'Multi-Status',
    description: 'A WebDAV response contains status information for multiple resources.',
    method: 'PROPFIND, PATCH',
    cache: 'No',
    retry: 'Inspect body',
    headers: ['Content-Type: application/xml'],
    tags: ['webdav', 'batch']
  },
  {
    code: 301,
    name: 'Moved Permanently',
    description: 'Permanent redirect. Clients may cache the new URL.',
    method: 'GET',
    cache: 'Yes',
    retry: 'Use Location',
    headers: ['Location: https://example.com/new'],
    tags: ['redirect', 'seo']
  },
  {
    code: 302,
    name: 'Found',
    description: 'Temporary redirect. Method may change to GET in older clients.',
    method: 'GET',
    cache: 'Sometimes',
    retry: 'Use Location',
    headers: ['Location: /login'],
    tags: ['redirect', 'temporary']
  },
  {
    code: 303,
    name: 'See Other',
    description: 'Redirect to a different resource with a GET request.',
    method: 'POST, PUT',
    cache: 'No',
    retry: 'Use Location',
    headers: ['Location: /receipts/123'],
    tags: ['redirect', 'post-redirect-get']
  },
  {
    code: 304,
    name: 'Not Modified',
    description: 'Cached response is still valid.',
    method: 'GET',
    cache: 'Yes',
    retry: 'Use cache',
    headers: ['ETag: "abc123"', 'Cache-Control: max-age=3600'],
    tags: ['cache', 'etag']
  },
  {
    code: 307,
    name: 'Temporary Redirect',
    description: 'Temporary redirect that preserves method and body.',
    method: 'Any',
    cache: 'No',
    retry: 'Use Location',
    headers: ['Location: /temporary'],
    tags: ['redirect', 'preserve-method']
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    description: 'Permanent redirect that preserves method and body.',
    method: 'Any',
    cache: 'Yes',
    retry: 'Use Location',
    headers: ['Location: https://example.com/new'],
    tags: ['redirect', 'permanent']
  },
  {
    code: 400,
    name: 'Bad Request',
    description: 'Request is malformed or fails basic validation.',
    method: 'Any',
    cache: 'No',
    retry: 'Fix request',
    headers: ['Content-Type: application/problem+json'],
    tags: ['client', 'validation']
  },
  {
    code: 401,
    name: 'Unauthorized',
    description: 'Authentication is missing or invalid.',
    method: 'Any',
    cache: 'No',
    retry: 'Authenticate',
    headers: ['WWW-Authenticate: Bearer realm="api"'],
    tags: ['auth', 'client']
  },
  {
    code: 403,
    name: 'Forbidden',
    description: 'Authenticated caller is not allowed to access the resource.',
    method: 'Any',
    cache: 'No',
    retry: 'Change permission',
    headers: ['Content-Type: application/problem+json'],
    tags: ['authz', 'client']
  },
  {
    code: 404,
    name: 'Not Found',
    description: 'Resource does not exist or is intentionally hidden.',
    method: 'Any',
    cache: 'Sometimes',
    retry: 'Check URL',
    headers: ['Cache-Control: no-store'],
    tags: ['client', 'routing']
  },
  {
    code: 405,
    name: 'Method Not Allowed',
    description: 'The resource exists but does not support this HTTP method.',
    method: 'Any',
    cache: 'No',
    retry: 'Use allowed method',
    headers: ['Allow: GET, POST'],
    tags: ['client', 'method']
  },
  {
    code: 406,
    name: 'Not Acceptable',
    description: 'Server cannot produce a representation matching the Accept headers.',
    method: 'GET',
    cache: 'No',
    retry: 'Change Accept',
    headers: ['Vary: Accept'],
    tags: ['client', 'content-negotiation']
  },
  {
    code: 408,
    name: 'Request Timeout',
    description: 'Server timed out waiting for the request.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes',
    headers: ['Connection: close'],
    tags: ['timeout', 'network']
  },
  {
    code: 409,
    name: 'Conflict',
    description: 'Request conflicts with current resource state.',
    method: 'PUT, PATCH',
    cache: 'No',
    retry: 'Resolve state',
    headers: ['Content-Type: application/problem+json'],
    tags: ['state', 'client']
  },
  {
    code: 410,
    name: 'Gone',
    description: 'Resource was intentionally removed and will not return.',
    method: 'GET',
    cache: 'Yes',
    retry: 'No',
    headers: ['Cache-Control: max-age=86400'],
    tags: ['client', 'permanent']
  },
  {
    code: 412,
    name: 'Precondition Failed',
    description: 'A conditional request header did not match the current resource state.',
    method: 'PUT, PATCH, DELETE',
    cache: 'No',
    retry: 'Refresh ETag',
    headers: ['ETag: "current-version"'],
    tags: ['etag', 'state']
  },
  {
    code: 413,
    name: 'Content Too Large',
    description: 'Request payload exceeds the server limit.',
    method: 'POST, PUT',
    cache: 'No',
    retry: 'Reduce payload',
    headers: ['Retry-After: 120'],
    tags: ['payload', 'limit']
  },
  {
    code: 415,
    name: 'Unsupported Media Type',
    description: 'Request body media type is not supported.',
    method: 'POST, PUT',
    cache: 'No',
    retry: 'Change Content-Type',
    headers: ['Accept: application/json'],
    tags: ['client', 'content-type']
  },
  {
    code: 416,
    name: 'Range Not Satisfiable',
    description: 'Requested byte range is outside the available representation.',
    method: 'GET',
    cache: 'No',
    retry: 'Adjust range',
    headers: ['Content-Range: bytes */4096'],
    tags: ['range', 'download']
  },
  {
    code: 418,
    name: "I'm a Teapot",
    description: 'A reserved April Fools status that should not be used for production errors.',
    method: 'Any',
    cache: 'No',
    retry: 'No',
    headers: ['Content-Type: text/plain'],
    tags: ['novelty', 'client']
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    description: 'Request is valid syntactically but fails domain validation.',
    method: 'POST, PATCH',
    cache: 'No',
    retry: 'Fix fields',
    headers: ['Content-Type: application/problem+json'],
    tags: ['validation', 'client']
  },
  {
    code: 423,
    name: 'Locked',
    description: 'The target WebDAV resource is locked.',
    method: 'PUT, PATCH, DELETE',
    cache: 'No',
    retry: 'Unlock resource',
    headers: ['Lock-Token: <opaquelocktoken:123>'],
    tags: ['webdav', 'state']
  },
  {
    code: 425,
    name: 'Too Early',
    description: 'Server is unwilling to risk processing a replayed early-data request.',
    method: 'POST',
    cache: 'No',
    retry: 'Retry later',
    headers: ['Early-Data: 1'],
    tags: ['tls', 'replay']
  },
  {
    code: 428,
    name: 'Precondition Required',
    description: 'The origin server requires a conditional request.',
    method: 'PUT, PATCH, DELETE',
    cache: 'No',
    retry: 'Send If-Match',
    headers: ['Require-Precondition: If-Match'],
    tags: ['etag', 'state']
  },
  {
    code: 429,
    name: 'Too Many Requests',
    description: 'Rate limit was exceeded.',
    method: 'Any',
    cache: 'No',
    retry: 'Back off',
    headers: ['Retry-After: 60', 'RateLimit-Remaining: 0'],
    tags: ['rate-limit', 'client']
  },
  {
    code: 431,
    name: 'Request Header Fields Too Large',
    description: 'Request headers are too large for the server to process.',
    method: 'Any',
    cache: 'No',
    retry: 'Reduce headers',
    headers: ['Connection: close'],
    tags: ['headers', 'limit']
  },
  {
    code: 451,
    name: 'Unavailable For Legal Reasons',
    description: 'Resource access is blocked for legal reasons.',
    method: 'GET',
    cache: 'Sometimes',
    retry: 'No',
    headers: ['Link: <https://example.com/policy>; rel="blocked-by"'],
    tags: ['legal', 'policy']
  },
  {
    code: 500,
    name: 'Internal Server Error',
    description: 'Unexpected server failure.',
    method: 'Any',
    cache: 'No',
    retry: 'Maybe',
    headers: ['Content-Type: application/problem+json'],
    tags: ['server', 'unexpected']
  },
  {
    code: 501,
    name: 'Not Implemented',
    description: 'Server does not support the requested functionality.',
    method: 'Any',
    cache: 'No',
    retry: 'No',
    headers: ['Content-Type: application/problem+json'],
    tags: ['server', 'capability']
  },
  {
    code: 502,
    name: 'Bad Gateway',
    description: 'Upstream service returned an invalid response.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes',
    headers: ['Via: gateway'],
    tags: ['upstream', 'server']
  },
  {
    code: 503,
    name: 'Service Unavailable',
    description: 'Server is overloaded or under maintenance.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes',
    headers: ['Retry-After: 120'],
    tags: ['maintenance', 'server']
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    description: 'Upstream service did not respond in time.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes',
    headers: ['Via: gateway'],
    tags: ['timeout', 'upstream']
  }
]

const STATUS_BY_CODE = new Map(STATUSES.map(status => [status.code, status]))

const SCENARIOS: ScenarioPreset[] = [
  {
    key: 'healthy',
    filter: '2xx',
    query: 'success',
    codes: [200, 201, 202, 204],
    sample: 'GET /api/health 200 18ms\nPOST /api/users 201 92ms\nDELETE /api/session 204 25ms'
  },
  {
    key: 'auth',
    filter: '4xx',
    query: 'auth',
    codes: [401, 403, 404],
    sample: 'GET /api/me 401 12ms\nGET /admin 403 15ms\nGET /api/hidden 404 9ms'
  },
  {
    key: 'rate_limit',
    filter: '4xx',
    query: 'rate-limit',
    codes: [202, 408, 425, 429, 503],
    sample: 'POST /api/jobs 202 80ms\nGET /api/search 429 4ms\nGET /api/report 503 620ms'
  },
  {
    key: 'redirect',
    filter: '3xx',
    query: 'redirect',
    codes: [301, 302, 303, 307, 308],
    sample: 'GET /old-path 301 3ms\nPOST /checkout 303 22ms\nPOST /upload 307 8ms'
  },
  {
    key: 'validation',
    filter: '4xx',
    query: 'validation',
    codes: [400, 409, 412, 422, 428],
    sample: 'POST /api/orders 400 19ms\nPATCH /api/users/42 409 33ms\nPOST /api/forms 422 16ms'
  },
  {
    key: 'outage',
    filter: '5xx',
    query: 'server',
    codes: [500, 502, 503, 504],
    sample: 'GET /api/invoices 500 510ms\nGET /api/search 502 430ms\nGET /api/report 504 15000ms'
  }
]

const statusClass = (code: number): StatusFamily => `${Math.floor(code / 100)}xx` as StatusFamily

const isRetryable = (status: StatusInfo) =>
  /yes|maybe|back off|poll|retry|later|location|continue|refresh|adjust|reduce/i.test(status.retry)

const isCacheable = (status: StatusInfo) => /yes|often|sometimes/i.test(status.cache)

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const createClassCounts = (): Record<StatusFamily, number> => ({
  '1xx': 0,
  '2xx': 0,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0
})

const headerPairs = (headers: string[]) =>
  headers.map(header => {
    const separator = header.indexOf(':')
    if (separator === -1) return [header, ''] as const

    return [header.slice(0, separator), header.slice(separator + 1).trim()] as const
  })

const headerObjectLiteral = (headers: string[], indent = '      ') => {
  if (!headers.length) return `${indent}'Cache-Control': 'no-store'`

  return headerPairs(headers)
    .map(([name, value]) => `${indent}'${name}': '${value.replaceAll("'", "\\'")}'`)
    .join(',\n')
}

const buildJsonSnippet = (status: StatusInfo) => `HTTP/1.1 ${status.code} ${status.name}
Content-Type: application/json
${status.headers.join('\n')}

{
  "status": ${status.code},
  "error": "${status.name}",
  "message": "${status.description}",
  "retry": "${status.retry}"
}`

const buildProblemSnippet = (status: StatusInfo) => `HTTP/1.1 ${status.code} ${status.name}
Content-Type: application/problem+json

{
  "type": "https://httpstatuses.com/${status.code}",
  "title": "${status.name}",
  "status": ${status.code},
  "detail": "${status.description}",
  "instance": "/requests/req_123"
}`

const buildHeadersSnippet = (status: StatusInfo) => `HTTP/1.1 ${status.code} ${status.name}
${status.headers.length ? status.headers.join('\n') : 'Content-Length: 0'}`

const buildCurlSnippet = (status: StatusInfo) => `curl -i https://api.example.com/resource \\
  -H "Accept: application/json"

# Expected
# HTTP/1.1 ${status.code} ${status.name}`

const buildNextSnippet = (status: StatusInfo) => `import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      message: '${status.name.replaceAll("'", "\\'")}',
      status: ${status.code}
    },
    {
      status: ${status.code},
      headers: {
${headerObjectLiteral(status.headers)}
      }
    }
  )
}`

const buildExpressSnippet = (status: StatusInfo) => `app.get('/resource', (req, res) => {
  res
    .status(${status.code})
    .set({
${headerObjectLiteral(status.headers, '      ')}
    })
    .json({
      message: '${status.name.replaceAll("'", "\\'")}',
      status: ${status.code}
    })
})`

const buildSnippet = (status: StatusInfo, type: SnippetType) => {
  switch (type) {
    case 'curl':
      return buildCurlSnippet(status)
    case 'express':
      return buildExpressSnippet(status)
    case 'headers':
      return buildHeadersSnippet(status)
    case 'next':
      return buildNextSnippet(status)
    case 'problem':
      return buildProblemSnippet(status)
    case 'json':
    default:
      return buildJsonSnippet(status)
  }
}

const statusSignals = (status: StatusInfo): StatusSignal[] => {
  const headers = status.headers.join('\n').toLowerCase()
  const signals: StatusSignal[] = []

  if (headers.includes('retry-after')) signals.push('retry_after')
  if (headers.includes('location:')) signals.push('location')
  if (headers.includes('www-authenticate')) signals.push('auth_header')
  if (headers.includes('application/problem+json')) signals.push('problem_json')
  if (isCacheable(status)) signals.push('cacheable')
  if (isRetryable(status)) signals.push('retry_plan')
  if (statusClass(status.code) === '5xx') signals.push('server_side')

  return signals
}

const analyzeBatch = (input: string): BatchAnalysis => {
  const truncated = input.slice(0, BATCH_INPUT_LIMIT)
  const matches = truncated.match(/\b[1-5]\d{2}\b/g) ?? []
  const codes = matches.slice(0, BATCH_CODE_LIMIT).map(Number)
  const grouped = new Map<number, number>()
  const classCounts = createClassCounts()
  let cacheable = 0
  let known = 0
  let retryable = 0

  for (const code of codes) {
    const status = STATUS_BY_CODE.get(code)

    grouped.set(code, (grouped.get(code) ?? 0) + 1)
    classCounts[statusClass(code)] += 1

    if (!status) continue
    known += 1
    if (isCacheable(status)) cacheable += 1
    if (isRetryable(status)) retryable += 1
  }

  const rows = Array.from(grouped.entries())
    .sort(([codeA, countA], [codeB, countB]) => countB - countA || codeA - codeB)
    .map(([code, count]) => {
      const status = STATUS_BY_CODE.get(code)

      return {
        cache: status?.cache ?? '-',
        className: statusClass(code),
        code,
        count,
        known: Boolean(status),
        name: status?.name ?? `HTTP ${code}`,
        retry: status?.retry ?? '-'
      }
    })

  const exportRows = rows.map(row => ({
    code: row.code,
    name: row.name,
    class: row.className,
    count: row.count,
    known: row.known,
    retry: row.retry,
    cache: row.cache
  }))
  const csvHeader = ['code', 'name', 'class', 'count', 'known', 'retry', 'cache']
  const exportCsv = [
    csvHeader.join(','),
    ...exportRows.map(row =>
      [row.code, row.name, row.class, row.count, row.known, row.retry, row.cache]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')

  return {
    cacheable,
    capped: input.length > BATCH_INPUT_LIMIT || matches.length > BATCH_CODE_LIMIT,
    classCounts,
    exportCsv,
    exportJson: JSON.stringify(
      {
        total: codes.length,
        unique: rows.length,
        known,
        unknown: codes.length - known,
        retryable,
        cacheable,
        classes: classCounts,
        rows: exportRows
      },
      null,
      2
    ),
    known,
    retryable,
    rows,
    total: codes.length,
    unknown: codes.length - known,
    unique: rows.length
  }
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const HttpStatusClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [query, setQuery] = useState('404')
  const deferredQuery = useDeferredValue(query)
  const [filter, setFilter] = useState<StatusClass>('all')
  const [snippetType, setSnippetType] = useState<SnippetType>('json')
  const [batchInput, setBatchInput] = useState(SCENARIOS[5].sample)
  const deferredBatchInput = useDeferredValue(batchInput)
  const [compareCodes, setCompareCodes] = useState<number[]>([200, 404, 503])

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return STATUSES.filter(status => {
      const matchesFilter = filter === 'all' || statusClass(status.code) === filter
      const matchesQuery =
        !normalized ||
        String(status.code).includes(normalized) ||
        status.name.toLowerCase().includes(normalized) ||
        status.description.toLowerCase().includes(normalized) ||
        status.tags.some(tag => tag.includes(normalized))

      return matchesFilter && matchesQuery
    })
  }, [deferredQuery, filter])

  const selected = results[0] ?? STATUS_BY_CODE.get(404) ?? STATUSES[0]
  const selectedClass = statusClass(selected.code)
  const snippet = useMemo(() => buildSnippet(selected, snippetType), [selected, snippetType])
  const signals = useMemo(() => statusSignals(selected), [selected])
  const batchAnalysis = useMemo(() => analyzeBatch(deferredBatchInput), [deferredBatchInput])
  const classCounts = useMemo(
    () =>
      STATUS_FAMILIES.map(className => ({
        className,
        count: STATUSES.filter(status => statusClass(status.code) === className).length
      })),
    []
  )
  const compareStatuses = useMemo(
    () => compareCodes.map(code => STATUS_BY_CODE.get(code)).filter(Boolean) as StatusInfo[],
    [compareCodes]
  )
  const comparisonSummary = useMemo(
    () =>
      compareStatuses
        .map(
          status =>
            `${status.code} ${status.name}: ${status.description} ${t(
              'app.converter.http_status.retry'
            )}: ${status.retry}; ${t('app.converter.http_status.cache')}: ${status.cache}`
        )
        .join('\n'),
    [compareStatuses, t]
  )
  const summary = useMemo(
    () =>
      [
        `${selected.code} ${selected.name}`,
        selected.description,
        `${t('app.converter.http_status.method')}: ${selected.method}`,
        `${t('app.converter.http_status.cache')}: ${selected.cache}`,
        `${t('app.converter.http_status.retry')}: ${selected.retry}`,
        `${t('app.converter.http_status.headers')}: ${selected.headers.join(', ') || '-'}`
      ].join('\n'),
    [selected, t]
  )
  const selectedIsCompared = compareCodes.includes(selected.code)

  const loadScenario = (scenario: ScenarioPreset) => {
    setQuery(scenario.query)
    setFilter(scenario.filter)
    setBatchInput(scenario.sample)
    setCompareCodes(scenario.codes.slice(0, COMPARE_LIMIT))
  }

  const toggleCompare = (code: number) => {
    setCompareCodes(current => {
      if (current.includes(code)) return current.filter(item => item !== code)
      if (current.length >= COMPARE_LIMIT) return [...current.slice(1), code]

      return [...current, code]
    })
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <ServerCrash className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.http_status')}
              </CardTitle>
              <CardDescription>{t('app.converter.http_status.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardList className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.http_status.copy_summary')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(snippet)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {classCounts.map(item => {
              const active = filter === item.className

              return (
                <button
                  key={item.className}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.className)}
                  className={`glass-input rounded-xl p-3 text-left transition hover:scale-[1.01] ${
                    active ? 'ring-2 ring-[var(--primary)]/40' : ''
                  }`}
                >
                  <div className="text-xs text-[var(--text-secondary)]">{item.className}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</div>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.http_status.scenarios')}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.map(scenario => (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => loadScenario(scenario)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {t(`app.converter.http_status.scenario.${scenario.key}`)}
                    </span>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {scenario.filter}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.http_status.scenario.${scenario.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="space-y-3">
              <Label htmlFor="status-search">{t('app.converter.http_status.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="status-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="404, unauthorized, timeout"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="status-filter">{t('app.converter.http_status.class')}</Label>
              <Select
                id="status-filter"
                value={filter}
                onChange={event => setFilter(event.target.value as StatusClass)}
              >
                {STATUS_CLASSES.map(value => (
                  <option key={value} value={value}>
                    {value === 'all' ? t('app.converter.http_status.all') : value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="status-snippet">{t('app.converter.http_status.snippet')}</Label>
              <Select
                id="status-snippet"
                value={snippetType}
                onChange={event => setSnippetType(event.target.value as SnippetType)}
              >
                {SNIPPET_TYPES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.http_status.snippet.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {t('app.converter.http_status.quick_codes')}
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_CODES.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setQuery(String(code))
                    setFilter('all')
                  }}
                  className="glass-input rounded-full px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] transition hover:scale-[1.04]"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.converter.http_status.results')}</CardTitle>
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.converter.http_status.result_count', { count: results.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {results.length ? (
              results.map(status => (
                <button
                  key={status.code}
                  type="button"
                  onClick={() => setQuery(String(status.code))}
                  className="glass-input rounded-xl p-4 text-left transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-xl font-semibold text-[var(--text-primary)]">
                      {status.code}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {statusClass(status.code)}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold text-[var(--text-primary)]">{status.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {status.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {status.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)] md:col-span-2">
                {t('app.converter.http_status.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t('app.converter.http_status.detail')}</CardTitle>
                <CardDescription>
                  {selected.code} {selected.name}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<GitCompare className="h-4 w-4" />}
                onClick={() => toggleCompare(selected.code)}
              >
                {t(
                  selectedIsCompared
                    ? 'app.converter.http_status.remove_compare'
                    : 'app.converter.http_status.add_compare'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatusMetric label={t('app.converter.http_status.method')} value={selected.method} />
              <StatusMetric label={t('app.converter.http_status.cache')} value={selected.cache} />
              <StatusMetric label={t('app.converter.http_status.retry')} value={selected.retry} />
              <StatusMetric label={t('app.converter.http_status.family')} value={selectedClass} />
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.http_status.triage')}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-primary)]">
                {t(`app.converter.http_status.triage.${selectedClass}`)}
              </p>
              {signals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {signals.map(signal => (
                    <span
                      key={signal}
                      className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]"
                    >
                      {t(`app.converter.http_status.signal.${signal}`)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.http_status.headers')}
              </p>
              <p className="mt-1 break-words font-mono text-sm text-[var(--text-primary)]">
                {selected.headers.join(', ') || '-'}
              </p>
            </div>

            <div className="glass-input rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.converter.http_status.compare')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => copy(comparisonSummary)}
                >
                  {t('public.copy')}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {compareStatuses.map(status => (
                  <div
                    key={status.code}
                    className="rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-[var(--text-primary)]">
                        {status.code}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {statusClass(status.code)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[var(--text-secondary)]">{status.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FileJson className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.http_status.snippet')}
            </div>
            <Textarea
              value={snippet}
              readOnly
              rows={12}
              className="min-h-[240px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.http_status.batch')}
              </CardTitle>
              <CardDescription>{t('app.converter.http_status.batch_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(batchAnalysis.exportJson)}
              >
                {t('app.converter.http_status.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    batchAnalysis.exportCsv,
                    'daily-tools-http-status.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.converter.http_status.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <Label htmlFor="status-batch">{t('app.converter.http_status.batch_input')}</Label>
              <Textarea
                id="status-batch"
                value={batchInput}
                onChange={event => setBatchInput(event.target.value.slice(0, BATCH_INPUT_LIMIT))}
                placeholder={t('app.converter.http_status.batch_placeholder')}
                rows={9}
                className="min-h-[220px] resize-y font-mono"
              />
              {batchAnalysis.capped && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.http_status.input_capped', { count: BATCH_CODE_LIMIT })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 self-start">
              <StatusMetric
                label={t('app.converter.http_status.metric.total')}
                value={String(batchAnalysis.total)}
              />
              <StatusMetric
                label={t('app.converter.http_status.metric.unique')}
                value={String(batchAnalysis.unique)}
              />
              <StatusMetric
                label={t('app.converter.http_status.metric.known')}
                value={String(batchAnalysis.known)}
              />
              <StatusMetric
                label={t('app.converter.http_status.metric.unknown')}
                value={String(batchAnalysis.unknown)}
              />
              <StatusMetric
                label={t('app.converter.http_status.metric.retryable')}
                value={String(batchAnalysis.retryable)}
              />
              <StatusMetric
                label={t('app.converter.http_status.metric.cacheable')}
                value={String(batchAnalysis.cacheable)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {STATUS_FAMILIES.map(className => (
              <div key={className} className="glass-input rounded-xl p-3">
                <p className="text-xs text-[var(--text-tertiary)]">{className}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {batchAnalysis.classCounts[className]}
                </p>
              </div>
            ))}
          </div>

          {batchAnalysis.rows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {batchAnalysis.rows.map(row => (
                <button
                  key={row.code}
                  type="button"
                  onClick={() => {
                    setQuery(String(row.code))
                    setFilter('all')
                  }}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-semibold text-[var(--text-primary)]">
                        {row.code}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{row.name}</p>
                    </div>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                      x{row.count}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-[var(--primary)]">
                      {row.className}
                    </span>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[var(--text-secondary)]">
                      {row.retry}
                    </span>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[var(--text-secondary)]">
                      {row.cache}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.http_status.batch_empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const StatusMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default HttpStatusClient
