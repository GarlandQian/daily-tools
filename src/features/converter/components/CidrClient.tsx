'use client'

import {
  Calculator,
  ClipboardList,
  Copy,
  Download,
  LocateFixed,
  Network,
  RotateCcw,
  ScissorsLineDashed
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
import { useCopy } from '@/hooks/useCopy'

type ExportFormat = 'json' | 'csv' | 'txt'

interface CidrResult {
  address: string
  binary: string
  broadcast: string
  classification: string
  firstUsable: string
  hostBits: number
  lastUsable: string
  mask: string
  maskBits: number
  network: string
  prefix: number
  totalAddresses: number
  usableAddresses: number
  wildcard: string
}

interface BatchCheck {
  address: string
  classification: string
  inRange: boolean
  valid: boolean
}

interface SubnetPreview {
  broadcast: string
  cidr: string
  firstUsable: string
  lastUsable: string
  network: string
  size: number
}

const PREFIX_PRESETS = [8, 10, 12, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
const MAX_BATCH_ADDRESSES = 200
const MAX_SUBNET_PREVIEW = 32
const cidrNumberFormatter = new Intl.NumberFormat()

const parseIpv4 = (value: string) => {
  const parts = value.trim().split('.')
  if (parts.length !== 4) return null

  const octets: number[] = []

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    octets.push(octet)
  }

  return octets.reduce((total, octet) => total * 256 + octet, 0) >>> 0
}

const intToIpv4 = (value: number) =>
  [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.')

const formatInteger = (value: number) => cidrNumberFormatter.format(value)

const toBinary = (value: number) =>
  [value >>> 24, value >>> 16, value >>> 8, value]
    .map(part => (part & 255).toString(2).padStart(8, '0'))
    .join('.')

const maskFromPrefix = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0)

const classifyIpv4 = (address: number) => {
  const first = (address >>> 24) & 255
  const second = (address >>> 16) & 255
  const third = (address >>> 8) & 255

  if (first === 10) return 'private'
  if (first === 172 && second >= 16 && second <= 31) return 'private'
  if (first === 192 && second === 168) return 'private'
  if (first === 127) return 'loopback'
  if (first === 169 && second === 254) return 'link_local'
  if (first === 100 && second >= 64 && second <= 127) return 'carrier'
  if (first === 192 && second === 0 && third === 2) return 'documentation'
  if (first === 198 && second === 51 && third === 100) return 'documentation'
  if (first === 203 && second === 0 && third === 113) return 'documentation'
  if (first >= 224 && first <= 239) return 'multicast'
  if (first >= 240) return 'reserved'
  if (first === 0) return 'reserved'
  return 'public'
}

const calculateCidr = (addressInput: string, prefix: number): CidrResult | null => {
  const address = parseIpv4(addressInput)
  if (address === null || prefix < 0 || prefix > 32) return null

  const mask = maskFromPrefix(prefix)
  const wildcard = ~mask >>> 0
  const network = (address & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const totalAddresses = 2 ** (32 - prefix)
  const usableAddresses = prefix >= 31 ? totalAddresses : Math.max(0, totalAddresses - 2)
  const firstUsable = prefix >= 31 ? network : network + 1
  const lastUsable = prefix >= 31 ? broadcast : broadcast - 1

  return {
    address: intToIpv4(address),
    binary: toBinary(address),
    broadcast: intToIpv4(broadcast),
    classification: classifyIpv4(address),
    firstUsable: intToIpv4(firstUsable),
    hostBits: 32 - prefix,
    lastUsable: intToIpv4(lastUsable),
    mask: intToIpv4(mask),
    maskBits: prefix,
    network: intToIpv4(network),
    prefix,
    totalAddresses,
    usableAddresses,
    wildcard: intToIpv4(wildcard)
  }
}

const containsAddress = (candidate: string, networkAddress: string, prefix: number) => {
  const candidateInt = parseIpv4(candidate)
  const networkInt = parseIpv4(networkAddress)
  if (candidateInt === null || networkInt === null) return null

  const mask = maskFromPrefix(prefix)
  return (candidateInt & mask) >>> 0 === (networkInt & mask) >>> 0
}

const getSubnetPreview = (networkAddress: string, currentPrefix: number, splitPrefix: number) => {
  const networkInt = parseIpv4(networkAddress)
  if (networkInt === null || splitPrefix < currentPrefix || splitPrefix > 32) return []

  const count = Math.min(MAX_SUBNET_PREVIEW, 2 ** (splitPrefix - currentPrefix))
  const blockSize = 2 ** (32 - splitPrefix)

  return Array.from({ length: count }, (_, index): SubnetPreview => {
    const start = (networkInt + index * blockSize) >>> 0
    const end = (start + blockSize - 1) >>> 0
    const firstUsable = splitPrefix >= 31 ? start : start + 1
    const lastUsable = splitPrefix >= 31 ? end : end - 1

    return {
      broadcast: intToIpv4(end),
      cidr: `${intToIpv4(start)}/${splitPrefix}`,
      firstUsable: intToIpv4(firstUsable),
      lastUsable: intToIpv4(lastUsable),
      network: intToIpv4(start),
      size: blockSize
    }
  })
}

const getAlignedBlockSize = (value: number) => {
  if (value === 0) return 2 ** 32

  let blockSize = 1
  while (blockSize < 2 ** 31 && value % (blockSize * 2) === 0) {
    blockSize *= 2
  }

  return blockSize
}

const summarizeRangeToCidrs = (startInput: string, endInput: string) => {
  const parsedStart = parseIpv4(startInput)
  const end = parseIpv4(endInput)
  if (parsedStart === null || end === null || parsedStart > end) return []

  const cidrs: string[] = []
  let start = parsedStart

  while (start <= end && cidrs.length < 128) {
    const maxSize = getAlignedBlockSize(start)
    let blockSize = maxSize
    while (blockSize > end - start + 1) blockSize = Math.floor(blockSize / 2)
    const prefix = 32 - Math.round(Math.log2(blockSize))
    cidrs.push(`${intToIpv4(start)}/${prefix}`)
    const nextStart: number = start + blockSize
    if (nextStart > 0xffffffff) break
    start = nextStart
  }

  return cidrs
}

const getUsableSamples = (result: CidrResult) => {
  const first = parseIpv4(result.firstUsable)
  const last = parseIpv4(result.lastUsable)
  if (first === null || last === null) return []
  const values = new Set<number>([first, last])
  const midpoint = Math.floor((first + last) / 2) >>> 0
  values.add(midpoint)
  return Array.from(values)
    .sort((a, b) => a - b)
    .map(intToIpv4)
}

const csvEscape = (value: string | number | boolean) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const clampInteger = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

const buildBatchExport = (
  checks: BatchCheck[],
  result: CidrResult | null,
  format: ExportFormat
) => {
  if (format === 'json') {
    return JSON.stringify(
      { cidr: result ? `${result.network}/${result.prefix}` : null, checks },
      null,
      2
    )
  }

  if (format === 'csv') {
    const rows = checks.map(item =>
      [item.address, item.valid, item.inRange, item.classification].map(csvEscape).join(',')
    )
    return ['address,valid,inRange,classification', ...rows].join('\n')
  }

  return checks
    .map(
      item => `${item.address}: ${item.valid ? (item.inRange ? 'inside' : 'outside') : 'invalid'}`
    )
    .join('\n')
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

const CidrClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [address, setAddress] = useState('192.168.10.42')
  const [prefix, setPrefix] = useState(24)
  const [candidate, setCandidate] = useState('192.168.10.99')
  const [batchInput, setBatchInput] = useState(
    '192.168.10.1\n192.168.10.99\n192.168.11.2\n10.0.0.1'
  )
  const [splitPrefix, setSplitPrefix] = useState(26)
  const [rangeStart, setRangeStart] = useState('192.168.10.0')
  const [rangeEnd, setRangeEnd] = useState('192.168.10.255')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [showOnlyMatches, setShowOnlyMatches] = useState(false)

  const result = useMemo(() => calculateCidr(address, prefix), [address, prefix])
  const candidateStatus = useMemo(() => {
    if (!result || !candidate.trim()) return null
    return containsAddress(candidate, result.network, prefix)
  }, [candidate, prefix, result])
  const subnets = useMemo(
    () => (result ? getSubnetPreview(result.network, prefix, splitPrefix) : []),
    [prefix, result, splitPrefix]
  )
  const formattedSubnets = useMemo(
    () =>
      subnets.map(subnet => ({
        ...subnet,
        formattedSize: formatInteger(subnet.size)
      })),
    [subnets]
  )
  const batchChecks = useMemo<BatchCheck[]>(() => {
    if (!result) return []
    return batchInput
      .split(/\r?\n|,|\s+/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, MAX_BATCH_ADDRESSES)
      .map(item => {
        const parsed = parseIpv4(item)
        if (parsed === null) {
          return { address: item, classification: 'invalid', inRange: false, valid: false }
        }
        return {
          address: intToIpv4(parsed),
          classification: classifyIpv4(parsed),
          inRange: containsAddress(item, result.network, prefix) ?? false,
          valid: true
        }
      })
  }, [batchInput, prefix, result])
  const visibleBatchChecks = showOnlyMatches
    ? batchChecks.filter(item => item.valid && item.inRange)
    : batchChecks
  const rangeCidrs = useMemo(
    () => summarizeRangeToCidrs(rangeStart, rangeEnd),
    [rangeEnd, rangeStart]
  )
  const usableSamples = useMemo(() => (result ? getUsableSamples(result) : []), [result])
  const batchExport = useMemo(
    () => buildBatchExport(batchChecks, result, exportFormat),
    [batchChecks, exportFormat, result]
  )
  const matchCount = batchChecks.filter(item => item.valid && item.inRange).length
  const invalidBatchCount = batchChecks.filter(item => !item.valid).length

  const formattedCounts = useMemo(
    () =>
      result
        ? {
            totalAddresses: formatInteger(result.totalAddresses),
            usableAddresses: formatInteger(result.usableAddresses)
          }
        : null,
    [result]
  )

  const summary = useMemo(
    () =>
      result && formattedCounts
        ? [
            `CIDR: ${result.network}/${prefix}`,
            `Mask: ${result.mask}`,
            `Wildcard: ${result.wildcard}`,
            `Broadcast: ${result.broadcast}`,
            `Usable: ${result.firstUsable} - ${result.lastUsable}`,
            `Addresses: ${formattedCounts.totalAddresses}`
          ].join('\n')
        : '',
    [formattedCounts, prefix, result]
  )

  const handlePrefixChange = (value: number) => {
    const nextPrefix = clampInteger(value, 0, 32, prefix)
    setPrefix(nextPrefix)
    setSplitPrefix(current => Math.max(nextPrefix, current))
  }

  const handleReset = () => {
    setAddress('192.168.10.42')
    setPrefix(24)
    setCandidate('192.168.10.99')
    setBatchInput('192.168.10.1\n192.168.10.99\n192.168.11.2\n10.0.0.1')
    setSplitPrefix(26)
    setRangeStart('192.168.10.0')
    setRangeEnd('192.168.10.255')
    setExportFormat('json')
    setShowOnlyMatches(false)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.cidr')}
              </CardTitle>
              <CardDescription>{t('app.converter.cidr.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                disabled={!result}
                onClick={() => copy(summary)}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CidrMetric
              label={t('app.converter.cidr.metric.batch')}
              value={formatInteger(batchChecks.length)}
            />
            <CidrMetric
              label={t('app.converter.cidr.metric.matches')}
              value={formatInteger(matchCount)}
            />
            <CidrMetric
              label={t('app.converter.cidr.metric.invalid')}
              value={formatInteger(invalidBatchCount)}
            />
            <CidrMetric
              label={t('app.converter.cidr.metric.subnets')}
              value={formatInteger(subnets.length)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="space-y-3">
              <Label htmlFor="cidr-address">{t('app.converter.cidr.address')}</Label>
              <Input
                id="cidr-address"
                value={address}
                onChange={event => setAddress(event.target.value)}
                placeholder="192.168.1.10"
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="cidr-prefix">{t('app.converter.cidr.prefix')}</Label>
              <Input
                id="cidr-prefix"
                type="number"
                min={0}
                max={32}
                value={prefix}
                onChange={event => handlePrefixChange(Number(event.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="cidr-preset">{t('app.converter.cidr.preset')}</Label>
              <Select
                id="cidr-preset"
                value={String(prefix)}
                onChange={event => handlePrefixChange(Number(event.target.value))}
              >
                {PREFIX_PRESETS.map(value => (
                  <option key={value} value={value}>
                    /{value}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {!result && (
            <p className="text-sm text-[var(--error)]">{t('app.converter.cidr.invalid')}</p>
          )}
        </CardContent>
      </Card>

      {result && formattedCounts && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cidr.results')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CidrMetric label="CIDR" value={`${result.network}/${prefix}`} />
                <CidrMetric
                  label={t('app.converter.cidr.classification')}
                  value={t(`app.converter.cidr.classification.${result.classification}`)}
                />
                <CidrMetric label={t('app.converter.cidr.mask')} value={result.mask} />
                <CidrMetric label={t('app.converter.cidr.wildcard')} value={result.wildcard} />
                <CidrMetric label={t('app.converter.cidr.network')} value={result.network} />
                <CidrMetric label={t('app.converter.cidr.broadcast')} value={result.broadcast} />
                <CidrMetric
                  label={t('app.converter.cidr.first_usable')}
                  value={result.firstUsable}
                />
                <CidrMetric label={t('app.converter.cidr.last_usable')} value={result.lastUsable} />
                <CidrMetric
                  label={t('app.converter.cidr.total')}
                  value={formattedCounts.totalAddresses}
                />
                <CidrMetric
                  label={t('app.converter.cidr.usable')}
                  value={formattedCounts.usableAddresses}
                />
                <CidrMetric
                  label={t('app.converter.cidr.mask_bits')}
                  value={String(result.maskBits)}
                />
                <CidrMetric
                  label={t('app.converter.cidr.host_bits')}
                  value={String(result.hostBits)}
                />
              </div>

              <div className="glass-input rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.cidr.binary')}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                  {result.binary}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {usableSamples.map(sample => (
                  <div key={sample} className="glass-input rounded-xl p-3">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {t('app.converter.cidr.sample_host')}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {sample}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LocateFixed className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.converter.cidr.contains')}
                </CardTitle>
                <CardDescription>{t('app.converter.cidr.contains_hint')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="cidr-candidate">{t('app.converter.cidr.candidate')}</Label>
                <Input
                  id="cidr-candidate"
                  value={candidate}
                  onChange={event => setCandidate(event.target.value)}
                  placeholder="192.168.10.99"
                  className="font-mono"
                />
                {candidateStatus !== null && (
                  <div
                    className={`rounded-xl px-3 py-2 text-sm ${
                      candidateStatus
                        ? 'bg-[var(--success-subtle)] text-[var(--success)]'
                        : 'bg-[var(--error-subtle)] text-[var(--error)]'
                    }`}
                  >
                    {candidateStatus
                      ? t('app.converter.cidr.contains_yes')
                      : t('app.converter.cidr.contains_no')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('app.converter.cidr.subnets')}</CardTitle>
                <CardDescription>{t('app.converter.cidr.subnets_hint')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="cidr-split">{t('app.converter.cidr.split_prefix')}</Label>
                  <Input
                    id="cidr-split"
                    type="number"
                    min={prefix}
                    max={32}
                    value={splitPrefix}
                    onChange={event =>
                      setSplitPrefix(
                        clampInteger(Number(event.target.value), prefix, 32, splitPrefix)
                      )
                    }
                    className="font-mono"
                  />
                </div>

                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {formattedSubnets.map(subnet => (
                    <div key={subnet.cidr} className="glass-input rounded-xl p-3">
                      <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {subnet.cidr}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
                        {subnet.network} - {subnet.broadcast} / {subnet.formattedSize}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
                        {subnet.firstUsable} - {subnet.lastUsable}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                    {t('app.converter.cidr.batch')}
                  </CardTitle>
                  <CardDescription>{t('app.converter.cidr.batch_hint')}</CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  disabled={!batchChecks.length}
                  onClick={() =>
                    downloadText(
                      batchExport,
                      `cidr-batch.${exportFormat}`,
                      exportFormat === 'json'
                        ? 'application/json;charset=utf-8'
                        : 'text/plain;charset=utf-8'
                    )
                  }
                >
                  {t('app.converter.cidr.download')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={batchInput}
                onChange={event => setBatchInput(event.target.value)}
                rows={8}
                className="font-mono"
                placeholder={t('app.converter.cidr.batch_placeholder')}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={exportFormat}
                  onChange={event => setExportFormat(event.target.value as ExportFormat)}
                >
                  <option value="json">{t('app.converter.cidr.export.json')}</option>
                  <option value="csv">{t('app.converter.cidr.export.csv')}</option>
                  <option value="txt">{t('app.converter.cidr.export.txt')}</option>
                </Select>
                <div className="glass-input rounded-xl px-3 py-2">
                  <Checkbox
                    checked={showOnlyMatches}
                    onChange={event => setShowOnlyMatches(event.target.checked)}
                    label={t('app.converter.cidr.only_matches')}
                  />
                </div>
                <Button type="button" variant="ghost" onClick={() => copy(batchExport)}>
                  {t('public.copy')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.converter.cidr.batch_results')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {visibleBatchChecks.map((item, index) => (
                  <div
                    key={`${item.address}-${item.classification}-${item.inRange}-${index}`}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {item.address}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {item.valid
                            ? t(`app.converter.cidr.classification.${item.classification}`)
                            : t('app.converter.cidr.invalid_short')}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.valid && item.inRange
                            ? 'bg-[var(--success-subtle)] text-[var(--success)]'
                            : 'bg-[var(--glass-input-bg)] text-[var(--text-tertiary)]'
                        }`}
                      >
                        {item.valid && item.inRange
                          ? t('app.converter.cidr.inside')
                          : t('app.converter.cidr.outside')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScissorsLineDashed className="h-4 w-4 text-[var(--primary)]" />
            {t('app.converter.cidr.range_to_cidr')}
          </CardTitle>
          <CardDescription>{t('app.converter.cidr.range_hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <Label htmlFor="cidr-range-start">{t('app.converter.cidr.range_start')}</Label>
            <Input
              id="cidr-range-start"
              value={rangeStart}
              onChange={event => setRangeStart(event.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="cidr-range-end">{t('app.converter.cidr.range_end')}</Label>
            <Input
              id="cidr-range-end"
              value={rangeEnd}
              onChange={event => setRangeEnd(event.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>{t('app.converter.cidr.range_output')}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!rangeCidrs.length}
                onClick={() => copy(rangeCidrs.join('\n'))}
              >
                {t('public.copy')}
              </Button>
            </div>
            <div className="max-h-36 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
              {rangeCidrs.length ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--text-primary)]">
                  {rangeCidrs.join('\n')}
                </pre>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('app.converter.cidr.range_empty')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const CidrMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

export default CidrClient
