'use client'

import { Copy, Globe, Link, Plus, RotateCcw, Trash2 } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      const url = new URL(inputUrl)
      setProtocol(url.protocol)
      setHost(url.host)
      setPathname(url.pathname)
      setHash(url.hash)

      const params: QueryParam[] = []
      url.searchParams.forEach((value, key) => {
        params.push({ key, value, id: Math.random().toString(36).substring(2, 11) })
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

  const handleParamChange = (id: string, field: 'key' | 'value', value: string) => {
    setQueryParams(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleAddParam = () => {
    setQueryParams(prev => [
      ...prev,
      { key: '', value: '', id: Math.random().toString(36).substring(2, 11) }
    ])
  }

  const handleDeleteParam = (id: string) => {
    setQueryParams(prev => prev.filter(p => p.id !== id))
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-[var(--primary)]" />
              URL Parser
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                icon={<Globe className="w-4 h-4" />}
                onClick={handleFromCurrentPage}
              >
                Current Page
              </Button>
              <Button size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Textarea
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="https://example.com/path?query=123"
              rows={2}
              className="flex-1 font-mono resize-none"
            />
            <Button
              variant="primary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleParse}
            >
              Parse
            </Button>
          </div>
          {error && <span className="text-[var(--error)] text-sm mt-2 block">{error}</span>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card>
          <CardHeader>
            <CardTitle>URL Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">Protocol</Label>
                <Select value={protocol} onChange={e => setProtocol(e.target.value)}>
                  <option value="http:">http://</option>
                  <option value="https:">https://</option>
                  <option value="ftp:">ftp://</option>
                  <option value="ws:">ws://</option>
                  <option value="wss:">wss://</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">Host</Label>
                <Input
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">Path</Label>
                <Input
                  value={pathname}
                  onChange={e => setPathname(e.target.value)}
                  placeholder="/path"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">Hash</Label>
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
            <div className="flex items-center justify-between">
              <CardTitle>Query Parameters</CardTitle>
              <Button
                size="sm"
                variant="outline"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleAddParam}
              >
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {queryParams.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No query parameters
                </p>
              )}
              {queryParams.map(param => (
                <div key={param.id} className="flex items-center gap-2">
                  <Input
                    value={param.key}
                    onChange={e => handleParamChange(param.id, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1"
                  />
                  <Input
                    value={param.value}
                    onChange={e => handleParamChange(param.id, 'value', e.target.value)}
                    placeholder="Value"
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
          <div className="flex items-center justify-between">
            <CardTitle>Constructed URL</CardTitle>
            <Button
              size="sm"
              icon={<Copy className="w-4 h-4" />}
              onClick={() => copy(constructedUrl)}
              disabled={!constructedUrl}
            >
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="glass-input rounded-lg p-3 font-mono text-sm break-all">
            {constructedUrl || (
              <span className="text-[var(--text-tertiary)]">Waiting for input...</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default UrlClient
