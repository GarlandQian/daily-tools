'use client'

import { Copy, Search, ServerCrash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type StatusClass = 'all' | '1xx' | '2xx' | '3xx' | '4xx' | '5xx'

interface StatusInfo {
  cache: string
  code: number
  description: string
  method: string
  name: string
  retry: string
}

const STATUSES: StatusInfo[] = [
  {
    code: 100,
    name: 'Continue',
    description: 'Interim response. Continue sending the request body.',
    method: 'Upload flows',
    cache: 'No',
    retry: 'Continue'
  },
  {
    code: 200,
    name: 'OK',
    description: 'Request succeeded and returned a normal response body.',
    method: 'GET, PUT',
    cache: 'Often',
    retry: 'No'
  },
  {
    code: 201,
    name: 'Created',
    description: 'Resource was created successfully.',
    method: 'POST',
    cache: 'No',
    retry: 'No'
  },
  {
    code: 202,
    name: 'Accepted',
    description: 'Request accepted for asynchronous processing.',
    method: 'POST, PATCH',
    cache: 'No',
    retry: 'Poll status'
  },
  {
    code: 204,
    name: 'No Content',
    description: 'Request succeeded with no response body.',
    method: 'DELETE, PATCH',
    cache: 'No',
    retry: 'No'
  },
  {
    code: 301,
    name: 'Moved Permanently',
    description: 'Permanent redirect. Clients may cache the new URL.',
    method: 'GET',
    cache: 'Yes',
    retry: 'Use Location'
  },
  {
    code: 302,
    name: 'Found',
    description: 'Temporary redirect. Method may change to GET in older clients.',
    method: 'GET',
    cache: 'Sometimes',
    retry: 'Use Location'
  },
  {
    code: 304,
    name: 'Not Modified',
    description: 'Cached response is still valid.',
    method: 'GET',
    cache: 'Yes',
    retry: 'Use cache'
  },
  {
    code: 307,
    name: 'Temporary Redirect',
    description: 'Temporary redirect that preserves method and body.',
    method: 'Any',
    cache: 'No',
    retry: 'Use Location'
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    description: 'Permanent redirect that preserves method and body.',
    method: 'Any',
    cache: 'Yes',
    retry: 'Use Location'
  },
  {
    code: 400,
    name: 'Bad Request',
    description: 'Request is malformed or fails basic validation.',
    method: 'Any',
    cache: 'No',
    retry: 'Fix request'
  },
  {
    code: 401,
    name: 'Unauthorized',
    description: 'Authentication is missing or invalid.',
    method: 'Any',
    cache: 'No',
    retry: 'Authenticate'
  },
  {
    code: 403,
    name: 'Forbidden',
    description: 'Authenticated caller is not allowed to access the resource.',
    method: 'Any',
    cache: 'No',
    retry: 'Change permission'
  },
  {
    code: 404,
    name: 'Not Found',
    description: 'Resource does not exist or is intentionally hidden.',
    method: 'Any',
    cache: 'Sometimes',
    retry: 'Check URL'
  },
  {
    code: 409,
    name: 'Conflict',
    description: 'Request conflicts with current resource state.',
    method: 'PUT, PATCH',
    cache: 'No',
    retry: 'Resolve state'
  },
  {
    code: 410,
    name: 'Gone',
    description: 'Resource was intentionally removed and will not return.',
    method: 'GET',
    cache: 'Yes',
    retry: 'No'
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    description: 'Request is valid syntactically but fails domain validation.',
    method: 'POST, PATCH',
    cache: 'No',
    retry: 'Fix fields'
  },
  {
    code: 429,
    name: 'Too Many Requests',
    description: 'Rate limit was exceeded.',
    method: 'Any',
    cache: 'No',
    retry: 'Back off'
  },
  {
    code: 500,
    name: 'Internal Server Error',
    description: 'Unexpected server failure.',
    method: 'Any',
    cache: 'No',
    retry: 'Maybe'
  },
  {
    code: 502,
    name: 'Bad Gateway',
    description: 'Upstream service returned an invalid response.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes'
  },
  {
    code: 503,
    name: 'Service Unavailable',
    description: 'Server is overloaded or under maintenance.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes'
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    description: 'Upstream service did not respond in time.',
    method: 'Any',
    cache: 'No',
    retry: 'Yes'
  }
]

const statusClass = (code: number): StatusClass => `${Math.floor(code / 100)}xx` as StatusClass

const HttpStatusClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [query, setQuery] = useState('404')
  const [filter, setFilter] = useState<StatusClass>('all')

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return STATUSES.filter(status => {
      const matchesFilter = filter === 'all' || statusClass(status.code) === filter
      const matchesQuery =
        !normalized ||
        String(status.code).includes(normalized) ||
        status.name.toLowerCase().includes(normalized) ||
        status.description.toLowerCase().includes(normalized)

      return matchesFilter && matchesQuery
    })
  }, [filter, query])
  const selected = results[0] ?? STATUSES.find(status => status.code === 404) ?? STATUSES[0]
  const snippet = `HTTP/1.1 ${selected.code} ${selected.name}
Content-Type: application/json

{
  "status": ${selected.code},
  "error": "${selected.name}",
  "message": "${selected.description}"
}`

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
            <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(snippet)}>
              {t('public.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
                {(['all', '1xx', '2xx', '3xx', '4xx', '5xx'] as const).map(value => (
                  <option key={value} value={value}>
                    {value === 'all' ? t('app.converter.http_status.all') : value}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.http_status.results')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {results.map(status => (
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
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.http_status.detail')}</CardTitle>
            <CardDescription>
              {selected.code} {selected.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatusMetric label={t('app.converter.http_status.method')} value={selected.method} />
              <StatusMetric label={t('app.converter.http_status.cache')} value={selected.cache} />
              <StatusMetric label={t('app.converter.http_status.retry')} value={selected.retry} />
              <StatusMetric
                label={t('app.converter.http_status.family')}
                value={statusClass(selected.code)}
              />
            </div>
            <Textarea
              value={snippet}
              readOnly
              rows={12}
              className="min-h-[260px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const StatusMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default HttpStatusClient
