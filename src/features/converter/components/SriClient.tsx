'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Link2,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const ALGORITHMS = ['sha256', 'sha384', 'sha512'] as const
const RESOURCE_TYPES = ['script', 'module', 'style', 'preload'] as const
const CROSS_ORIGIN_MODES = ['anonymous', 'use-credentials', 'none'] as const
const OUTPUT_TYPES = ['attribute', 'script', 'link', 'next', 'csp', 'json'] as const
const TEXT_INPUT_LIMIT = 220000
const WORKSPACE_LIMIT = 36000
const PARSED_ROW_LIMIT = 120
const FILE_SIZE_LIMIT = 8 * 1024 * 1024

type Algorithm = (typeof ALGORITHMS)[number]
type ResourceType = (typeof RESOURCE_TYPES)[number]
type CrossOriginMode = (typeof CROSS_ORIGIN_MODES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey = 'cdn_script' | 'stylesheet' | 'module' | 'preload' | 'inline_csp'
type FindingLevel = 'good' | 'warn' | 'danger'

interface Preset {
  algorithms: Algorithm[]
  crossOrigin: CrossOriginMode
  key: PresetKey
  outputType: OutputType
  resourceType: ResourceType
  source: string
  url: string
  workspace: string
}

interface IntegrityHash {
  algorithm: Algorithm
  base64: string
  token: string
}

interface FileInfo {
  name: string
  size: number
  type: string
}

interface ParsedToken {
  algorithm: string
  hash: string
  known: boolean
  token: string
}

interface ParsedAsset {
  crossOrigin: string
  kind: string
  raw: string
  tokens: ParsedToken[]
  url: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DIGEST_NAMES: Record<Algorithm, string> = {
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512'
}

const EXPECTED_BASE64_LENGTH: Record<Algorithm, number> = {
  sha256: 44,
  sha384: 64,
  sha512: 88
}

const SAMPLE_SOURCES: Record<PresetKey, string> = {
  cdn_script: `window.dailyTools = window.dailyTools || {};
window.dailyTools.boot = function bootDailyTools() {
  return "ready";
};`,
  stylesheet: `:root {
  color-scheme: light dark;
}
.asset-card {
  border-radius: 8px;
}`,
  module: `export function mountWidget(target) {
  target.dataset.ready = "true";
  return target;
}`,
  preload: `self.addEventListener("install", event => {
  event.waitUntil(caches.open("assets-v1"));
});`,
  inline_csp: `const featureFlags = {
  checkout: true,
  analytics: false
};`
}

const PRESETS: Preset[] = [
  {
    key: 'cdn_script',
    source: SAMPLE_SOURCES.cdn_script,
    url: 'https://cdn.example.com/app.min.js',
    resourceType: 'script',
    crossOrigin: 'anonymous',
    outputType: 'script',
    algorithms: ['sha384'],
    workspace:
      '<script src="https://cdn.example.com/app.min.js" integrity="sha384-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890" crossorigin="anonymous"></script>'
  },
  {
    key: 'stylesheet',
    source: SAMPLE_SOURCES.stylesheet,
    url: 'https://cdn.example.com/theme.css',
    resourceType: 'style',
    crossOrigin: 'anonymous',
    outputType: 'link',
    algorithms: ['sha384', 'sha512'],
    workspace:
      '<link rel="stylesheet" href="https://cdn.example.com/theme.css" integrity="sha384-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890" crossorigin="anonymous">'
  },
  {
    key: 'module',
    source: SAMPLE_SOURCES.module,
    url: 'https://cdn.example.com/widget.mjs',
    resourceType: 'module',
    crossOrigin: 'anonymous',
    outputType: 'script',
    algorithms: ['sha384'],
    workspace:
      '<script type="module" src="https://cdn.example.com/widget.mjs" integrity="sha384-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890" crossorigin="anonymous"></script>'
  },
  {
    key: 'preload',
    source: SAMPLE_SOURCES.preload,
    url: 'https://cdn.example.com/worker.js',
    resourceType: 'preload',
    crossOrigin: 'anonymous',
    outputType: 'link',
    algorithms: ['sha384'],
    workspace:
      '<link rel="preload" as="script" href="https://cdn.example.com/worker.js" integrity="sha384-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890" crossorigin="anonymous">'
  },
  {
    key: 'inline_csp',
    source: SAMPLE_SOURCES.inline_csp,
    url: '',
    resourceType: 'script',
    crossOrigin: 'none',
    outputType: 'csp',
    algorithms: ['sha256', 'sha384'],
    workspace: "script-src 'self' 'sha256-AbCdEf1234567890AbCdEf1234567890AbCdEf12='"
  }
]

const SUPPORTED_ALGORITHM_SET = new Set<string>(ALGORITHMS)

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB'] as const
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: unitIndex ? 1 : 0 }).format(value)} ${units[unitIndex]}`
}

const bytesToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return window.btoa(binary)
}

const normalizeUrl = (value: string) => value.trim().replaceAll('"', '&quot;')
const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const isExternalUrl = (value: string) => /^https?:\/\//iu.test(value.trim())
const getCrossOriginHtml = (mode: CrossOriginMode) =>
  mode === 'none' ? '' : ` crossorigin="${mode}"`
const getCrossOriginReact = (mode: CrossOriginMode) =>
  mode === 'none' ? '' : ` crossOrigin="${mode}"`

const buildOutput = (
  hashes: IntegrityHash[],
  outputType: OutputType,
  resourceType: ResourceType,
  resourceUrl: string,
  crossOrigin: CrossOriginMode
) => {
  const integrity = hashes.map(hash => hash.token).join(' ')
  const url = normalizeUrl(resourceUrl) || 'https://cdn.example.com/app.js'
  const escapedIntegrity = escapeHtml(integrity)
  const escapedUrl = escapeHtml(url)
  const htmlCrossOrigin = getCrossOriginHtml(crossOrigin)
  const reactCrossOrigin = getCrossOriginReact(crossOrigin)
  const cspDirective = resourceType === 'style' ? 'style-src' : 'script-src'
  const cspTokens = hashes.map(hash => `'${hash.token}'`).join(' ')

  if (!integrity) return ''

  switch (outputType) {
    case 'attribute':
      return `integrity="${escapedIntegrity}"${htmlCrossOrigin}`
    case 'script':
      return `<script${resourceType === 'module' ? ' type="module"' : ''} src="${escapedUrl}" integrity="${escapedIntegrity}"${htmlCrossOrigin}></script>`
    case 'link':
      if (resourceType === 'style') {
        return `<link rel="stylesheet" href="${escapedUrl}" integrity="${escapedIntegrity}"${htmlCrossOrigin}>`
      }

      return `<link rel="preload" as="script" href="${escapedUrl}" integrity="${escapedIntegrity}"${htmlCrossOrigin}>`
    case 'next':
      if (resourceType === 'style' || resourceType === 'preload') {
        const rel = resourceType === 'style' ? 'stylesheet' : 'preload'
        const asValue = resourceType === 'preload' ? ' as="script"' : ''

        return `<link rel="${rel}"${asValue} href="${escapedUrl}" integrity="${escapedIntegrity}"${htmlCrossOrigin} />`
      }

      return `import Script from 'next/script'

<Script src="${escapedUrl}" integrity="${escapedIntegrity}"${reactCrossOrigin}${resourceType === 'module' ? ' type="module"' : ''} />`
    case 'csp':
      return `${cspDirective} 'self' ${cspTokens};`
    case 'json':
      return JSON.stringify(
        {
          integrity,
          hashes,
          resourceType,
          resourceUrl: url,
          crossOrigin
        },
        null,
        2
      )
    default:
      return integrity
  }
}

const getAttributeValue = (tag: string, attribute: string) => {
  const pattern = new RegExp(`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu')
  const match = pattern.exec(tag)

  return match?.[1] || match?.[2] || match?.[3] || ''
}

const parseTokens = (value: string): ParsedToken[] => {
  const rows: ParsedToken[] = []
  const seen = new Set<string>()
  const tokenPattern = /\b([a-z0-9]+)-([A-Za-z0-9+/=]+)\b/giu

  for (const match of value.matchAll(tokenPattern)) {
    const algorithm = match[1].toLowerCase()
    const hash = match[2]
    const token = `${algorithm}-${hash}`

    if (seen.has(token)) continue
    seen.add(token)
    rows.push({
      algorithm,
      hash,
      known: SUPPORTED_ALGORITHM_SET.has(algorithm),
      token
    })
  }

  return rows
}

const parseWorkspace = (input: string): ParsedAsset[] => {
  const safeInput = input.slice(0, WORKSPACE_LIMIT)
  const rows: ParsedAsset[] = []
  const tagPattern = /<(script|link)\b[^>]*>/giu

  for (const match of safeInput.matchAll(tagPattern)) {
    const raw = match[0]
    const kind = match[1].toLowerCase()
    const integrity = getAttributeValue(raw, 'integrity')
    const url = getAttributeValue(raw, kind === 'script' ? 'src' : 'href')

    rows.push({
      crossOrigin: getAttributeValue(raw, 'crossorigin'),
      kind,
      raw,
      tokens: parseTokens(integrity),
      url
    })

    if (rows.length >= PARSED_ROW_LIMIT) return rows
  }

  if (!rows.length) {
    const tokens = parseTokens(safeInput)
    if (tokens.length) {
      rows.push({
        crossOrigin: '',
        kind: 'token',
        raw: safeInput.trim().slice(0, 400),
        tokens,
        url: ''
      })
    }
  }

  return rows.slice(0, PARSED_ROW_LIMIT)
}

const auditSri = (
  hashes: IntegrityHash[],
  algorithms: Algorithm[],
  resourceUrl: string,
  crossOrigin: CrossOriginMode,
  sourceByteLength: number,
  parsedAssets: ParsedAsset[],
  fileError: string
): Finding[] => {
  const findings: Finding[] = []

  if (fileError) findings.push({ key: fileError, level: 'danger', subject: 'file' })
  if (!sourceByteLength) findings.push({ key: 'empty_source', level: 'warn', subject: 'source' })
  if (!hashes.length && sourceByteLength)
    findings.push({ key: 'hash_pending', level: 'warn', subject: 'source' })
  if (hashes.length && algorithms.includes('sha384')) {
    findings.push({ key: 'sha384_ok', level: 'good', subject: 'builder' })
  } else if (hashes.length && algorithms.includes('sha256') && algorithms.length === 1) {
    findings.push({ key: 'sha256_only', level: 'warn', subject: 'builder' })
  }

  if (isExternalUrl(resourceUrl) && crossOrigin === 'none') {
    findings.push({ key: 'crossorigin_missing', level: 'warn', subject: 'builder' })
  } else if (isExternalUrl(resourceUrl)) {
    findings.push({ key: 'crossorigin_ok', level: 'good', subject: 'builder' })
  }

  for (const asset of parsedAssets) {
    if ((asset.kind === 'script' || asset.kind === 'link') && asset.url && !asset.tokens.length) {
      findings.push({ key: 'parsed_missing_integrity', level: 'warn', subject: asset.url })
    }

    if (asset.url && isExternalUrl(asset.url) && !asset.crossOrigin) {
      findings.push({ key: 'parsed_crossorigin_missing', level: 'warn', subject: asset.url })
    }

    for (const token of asset.tokens) {
      if (!token.known) {
        findings.push({ key: 'unsupported_algorithm', level: 'danger', subject: token.algorithm })
      } else {
        const expectedLength = EXPECTED_BASE64_LENGTH[token.algorithm as Algorithm]
        if (token.hash.length < expectedLength - 4) {
          findings.push({ key: 'hash_too_short', level: 'warn', subject: token.algorithm })
        }
      }
    }

    const strongCount = asset.tokens.filter(token => token.known).length
    if (strongCount > 1) {
      findings.push({ key: 'multi_hash_ok', level: 'good', subject: asset.url || asset.kind })
    }
  }

  return findings.length
    ? findings
    : [{ key: 'empty_workspace', level: 'warn', subject: 'workspace' }]
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getFindingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

function SriMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function SriClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [sourceMode, setSourceMode] = useState<'text' | 'file'>('text')
  const [sourceText, setSourceText] = useState(PRESETS[0].source)
  const [resourceUrl, setResourceUrl] = useState(PRESETS[0].url)
  const [resourceType, setResourceType] = useState<ResourceType>(PRESETS[0].resourceType)
  const [crossOrigin, setCrossOrigin] = useState<CrossOriginMode>(PRESETS[0].crossOrigin)
  const [outputType, setOutputType] = useState<OutputType>(PRESETS[0].outputType)
  const [algorithms, setAlgorithms] = useState<Algorithm[]>(PRESETS[0].algorithms)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null)
  const [fileError, setFileError] = useState('')
  const [hashes, setHashes] = useState<IntegrityHash[]>([])
  const [isHashing, setIsHashing] = useState(false)
  const [hashError, setHashError] = useState('')
  const deferredSourceText = useDeferredValue(sourceText)
  const deferredWorkspace = useDeferredValue(workspace)

  const sourcePayload = useMemo(() => {
    if (sourceMode === 'file' && fileBytes) {
      return {
        bytes: new Uint8Array(fileBytes),
        truncated: false
      }
    }

    const truncated = deferredSourceText.length > TEXT_INPUT_LIMIT
    const safeText = truncated ? deferredSourceText.slice(0, TEXT_INPUT_LIMIT) : deferredSourceText

    return {
      bytes: new TextEncoder().encode(safeText),
      truncated
    }
  }, [deferredSourceText, fileBytes, sourceMode])

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!sourcePayload.bytes.length || !algorithms.length) {
        setHashes([])
        setIsHashing(false)
        return
      }

      if (!window.crypto?.subtle) {
        setHashError('crypto_unavailable')
        setHashes([])
        return
      }

      setIsHashing(true)
      setHashError('')

      try {
        const nextHashes = await Promise.all(
          algorithms.map(async algorithm => {
            const digest = await window.crypto.subtle.digest(
              DIGEST_NAMES[algorithm],
              sourcePayload.bytes
            )
            const base64 = bytesToBase64(digest)

            return {
              algorithm,
              base64,
              token: `${algorithm}-${base64}`
            }
          })
        )

        if (active) setHashes(nextHashes)
      } catch {
        if (active) {
          setHashes([])
          setHashError('hash_failed')
        }
      } finally {
        if (active) setIsHashing(false)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [algorithms, sourcePayload])

  const output = useMemo(
    () => buildOutput(hashes, outputType, resourceType, resourceUrl, crossOrigin),
    [crossOrigin, hashes, outputType, resourceType, resourceUrl]
  )
  const parsedAssets = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(
    () =>
      auditSri(
        hashes,
        algorithms,
        resourceUrl,
        crossOrigin,
        sourcePayload.bytes.length,
        parsedAssets,
        fileError || hashError
      ),
    [
      algorithms,
      crossOrigin,
      fileError,
      hashError,
      hashes,
      parsedAssets,
      resourceUrl,
      sourcePayload.bytes.length
    ]
  )
  const metrics = useMemo(() => {
    const parsedTokenCount = parsedAssets.reduce((count, asset) => count + asset.tokens.length, 0)
    const riskCount = findings.filter(finding => finding.level !== 'good').length

    return {
      bytes: formatBytes(sourcePayload.bytes.length),
      hashes: String(hashes.length),
      parsed: String(parsedAssets.length),
      tokens: String(parsedTokenCount),
      risks: String(riskCount)
    }
  }, [findings, hashes.length, parsedAssets, sourcePayload.bytes.length])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          generated: {
            hashes,
            integrity: hashes.map(hash => hash.token).join(' '),
            resourceUrl,
            resourceType,
            crossOrigin
          },
          parsedAssets,
          findings
        },
        null,
        2
      ),
    [crossOrigin, findings, hashes, parsedAssets, resourceType, resourceUrl]
  )
  const exportCsv = useMemo(
    () =>
      [
        ['kind', 'url', 'crossOrigin', 'algorithm', 'known', 'token'],
        ...parsedAssets.flatMap(asset =>
          asset.tokens.length
            ? asset.tokens.map(token => [
                asset.kind,
                asset.url,
                asset.crossOrigin,
                token.algorithm,
                String(token.known),
                token.token
              ])
            : [[asset.kind, asset.url, asset.crossOrigin, '', 'false', '']]
        )
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [parsedAssets]
  )

  const applyPreset = (preset: Preset) => {
    setSourceMode('text')
    setSourceText(preset.source)
    setResourceUrl(preset.url)
    setResourceType(preset.resourceType)
    setCrossOrigin(preset.crossOrigin)
    setOutputType(preset.outputType)
    setAlgorithms(preset.algorithms)
    setWorkspace(preset.workspace)
    setFileInfo(null)
    setFileBytes(null)
    setFileError('')
  }

  const toggleAlgorithm = (algorithm: Algorithm) => {
    setAlgorithms(current =>
      current.includes(algorithm)
        ? current.filter(item => item !== algorithm)
        : ALGORITHMS.filter(item => item === algorithm || current.includes(item))
    )
  }

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return
    setSourceMode('file')
    setFileError('')

    if (file.size > FILE_SIZE_LIMIT) {
      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      })
      setFileBytes(null)
      setFileError('file_too_large')
      return
    }

    try {
      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      })
      setFileBytes(await file.arrayBuffer())
    } catch {
      setFileBytes(null)
      setFileError('file_read_failed')
    }
  }

  const clearFile = () => {
    setFileInfo(null)
    setFileBytes(null)
    setFileError('')
    setSourceMode('text')
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.sri.summary_title'),
        `${t('app.converter.sri.metric.bytes')}: ${metrics.bytes}`,
        `${t('app.converter.sri.metric.hashes')}: ${metrics.hashes}`,
        `${t('app.converter.sri.metric.risks')}: ${metrics.risks}`,
        hashes.map(hash => hash.token).join(' ')
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="glass-panel glass-clip">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <ShieldCheck className="h-4 w-4" />
                {t('app.converter.sri')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.sri')}</CardTitle>
              <CardDescription>{t('app.converter.sri.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.sri.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SriMetric label={t('app.converter.sri.metric.bytes')} value={metrics.bytes} />
            <SriMetric label={t('app.converter.sri.metric.hashes')} value={metrics.hashes} />
            <SriMetric label={t('app.converter.sri.metric.parsed')} value={metrics.parsed} />
            <SriMetric label={t('app.converter.sri.metric.tokens')} value={metrics.tokens} />
            <SriMetric label={t('app.converter.sri.metric.risks')} value={metrics.risks} />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.sri.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.sri.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.sri.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.sri.builder')}</CardTitle>
            <CardDescription>{t('app.converter.sri.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="sri-resource-url">{t('app.converter.sri.resource_url')}</Label>
                <Input
                  id="sri-resource-url"
                  value={resourceUrl}
                  onChange={event => setResourceUrl(event.target.value)}
                  placeholder="https://cdn.example.com/app.js"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="sri-resource-type">{t('app.converter.sri.resource_type')}</Label>
                <Select
                  id="sri-resource-type"
                  value={resourceType}
                  onChange={event => setResourceType(event.target.value as ResourceType)}
                >
                  {RESOURCE_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.sri.resource.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="sri-crossorigin">{t('app.converter.sri.crossorigin')}</Label>
                <Select
                  id="sri-crossorigin"
                  value={crossOrigin}
                  onChange={event => setCrossOrigin(event.target.value as CrossOriginMode)}
                >
                  {CROSS_ORIGIN_MODES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.sri.crossorigin.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.sri.source_mode')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['text', 'file'] as const).map(mode => (
                  <Button
                    key={mode}
                    type="button"
                    variant={sourceMode === mode ? 'default' : 'outline'}
                    onClick={() => setSourceMode(mode)}
                  >
                    {mode === 'file' ? (
                      <Upload className="h-4 w-4" />
                    ) : (
                      <FileCode2 className="h-4 w-4" />
                    )}
                    {t(`app.converter.sri.source_mode.${mode}`)}
                  </Button>
                ))}
              </div>
            </div>

            {sourceMode === 'text' ? (
              <div className="space-y-3">
                <Label htmlFor="sri-source">{t('app.converter.sri.source')}</Label>
                <Textarea
                  id="sri-source"
                  value={sourceText}
                  onChange={event => setSourceText(event.target.value)}
                  placeholder={t('app.converter.sri.source_placeholder')}
                  className="min-h-[220px] font-mono"
                />
                {sourcePayload.truncated ? (
                  <p className="text-xs text-amber-600">
                    {t('app.converter.sri.warning.truncated', { count: TEXT_INPUT_LIMIT })}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="sri-file">{t('app.converter.sri.file')}</Label>
                <Input
                  id="sri-file"
                  type="file"
                  onChange={event => void handleFileChange(event.target.files?.[0])}
                />
                <div className="glass-input rounded-xl p-3 text-sm text-[var(--text-secondary)]">
                  {fileInfo ? (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="break-all font-medium text-[var(--text-primary)]">
                          {fileInfo.name}
                        </p>
                        <p className="mt-1 text-xs">
                          {formatBytes(fileInfo.size)} / {fileInfo.type}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={clearFile}>
                        <Trash2 className="h-4 w-4" />
                        {t('app.converter.sri.clear_file')}
                      </Button>
                    </div>
                  ) : (
                    t('app.converter.sri.file_empty')
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>{t('app.converter.sri.algorithms')}</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {ALGORITHMS.map(algorithm => (
                  <label
                    key={algorithm}
                    className="glass-input flex items-center gap-3 rounded-xl p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={algorithms.includes(algorithm)}
                      onChange={() => toggleAlgorithm(algorithm)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      {t(`app.converter.sri.algorithm.${algorithm}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.sri.output')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.sri.output_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="sri-output-type">{t('app.converter.sri.output_type')}</Label>
              <Select
                id="sri-output-type"
                value={outputType}
                onChange={event => setOutputType(event.target.value as OutputType)}
              >
                {OUTPUT_TYPES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.sri.output_type.${value}`)}
                  </option>
                ))}
              </Select>
            </div>

            <Textarea
              readOnly
              value={
                isHashing
                  ? t('app.converter.sri.hashing')
                  : output || t('app.converter.sri.output_empty')
              }
              className="min-h-[240px] font-mono"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button type="button" onClick={() => copy(output)} disabled={!output || isHashing}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWorkspace(output)}
                disabled={!output || isHashing}
              >
                <Link2 className="h-4 w-4" />
                {t('app.converter.sri.use_output')}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.sri.audit')}
              </h3>
              <div className="space-y-2">
                {findings.slice(0, 10).map((finding, index) => (
                  <div
                    key={`${finding.key}:${finding.subject}:${index}`}
                    className={`rounded-xl border px-3 py-2 text-xs ${getFindingClass(finding.level)}`}
                  >
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2">/</span>
                    {t(`app.converter.sri.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">{t('app.converter.sri.workspace')}</CardTitle>
              <CardDescription>{t('app.converter.sri.workspace_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(exportJson)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.sri.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadText(exportCsv, 'sri-assets.csv', 'text/csv;charset=utf-8')}
              >
                <Download className="h-4 w-4" />
                {t('app.converter.sri.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={workspace}
            onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
            placeholder={t('app.converter.sri.workspace_placeholder')}
            className="min-h-[180px] font-mono"
          />

          {parsedAssets.length ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {parsedAssets.map((asset, index) => (
                <div
                  key={`${asset.kind}:${asset.url}:${index}`}
                  className="glass-input rounded-xl p-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {asset.kind}
                      </p>
                      <p className="mt-1 break-all text-xs text-[var(--text-secondary)]">
                        {asset.url || t('app.converter.sri.no_url')}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {asset.crossOrigin || t('app.converter.sri.no_crossorigin')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {asset.tokens.length ? (
                      asset.tokens.map(token => (
                        <button
                          key={token.token}
                          type="button"
                          onClick={() => copy(token.token)}
                          className="rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]"
                        >
                          {token.algorithm}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-amber-600">
                        {t('app.converter.sri.no_integrity')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.sri.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
