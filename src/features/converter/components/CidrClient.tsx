'use client'

import { Calculator, Copy, LocateFixed, Network, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

interface CidrResult {
  address: string
  binary: string
  broadcast: string
  classification: string
  firstUsable: string
  lastUsable: string
  mask: string
  network: string
  totalAddresses: number
  usableAddresses: number
  wildcard: string
}

const PREFIX_PRESETS = [8, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]

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

const toBinary = (value: number) =>
  intToIpv4(value)
    .split('.')
    .map(part => Number(part).toString(2).padStart(8, '0'))
    .join('.')

const maskFromPrefix = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0)

const classifyIpv4 = (address: number) => {
  const first = (address >>> 24) & 255
  const second = (address >>> 16) & 255

  if (first === 10) return 'private'
  if (first === 172 && second >= 16 && second <= 31) return 'private'
  if (first === 192 && second === 168) return 'private'
  if (first === 127) return 'loopback'
  if (first === 169 && second === 254) return 'link_local'
  if (first >= 224 && first <= 239) return 'multicast'
  if (first === 0) return 'reserved'
  if (first === 255) return 'broadcast'
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
    lastUsable: intToIpv4(lastUsable),
    mask: intToIpv4(mask),
    network: intToIpv4(network),
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

  const count = Math.min(8, 2 ** (splitPrefix - currentPrefix))
  const blockSize = 2 ** (32 - splitPrefix)

  return Array.from({ length: count }, (_, index) => {
    const start = (networkInt + index * blockSize) >>> 0
    const end = (start + blockSize - 1) >>> 0

    return {
      broadcast: intToIpv4(end),
      cidr: `${intToIpv4(start)}/${splitPrefix}`,
      network: intToIpv4(start),
      size: blockSize
    }
  })
}

const CidrClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [address, setAddress] = useState('192.168.10.42')
  const [prefix, setPrefix] = useState(24)
  const [candidate, setCandidate] = useState('192.168.10.99')
  const [splitPrefix, setSplitPrefix] = useState(26)

  const result = useMemo(() => calculateCidr(address, prefix), [address, prefix])
  const candidateStatus = useMemo(() => {
    if (!result || !candidate.trim()) return null
    return containsAddress(candidate, result.network, prefix)
  }, [candidate, prefix, result])
  const subnets = useMemo(
    () => (result ? getSubnetPreview(result.network, prefix, splitPrefix) : []),
    [prefix, result, splitPrefix]
  )

  const summary = result
    ? [
        `CIDR: ${result.network}/${prefix}`,
        `Mask: ${result.mask}`,
        `Wildcard: ${result.wildcard}`,
        `Broadcast: ${result.broadcast}`,
        `Usable: ${result.firstUsable} - ${result.lastUsable}`,
        `Addresses: ${result.totalAddresses}`
      ].join('\n')
    : ''

  const handlePrefixChange = (value: number) => {
    const nextPrefix = Math.min(32, Math.max(0, value))
    setPrefix(nextPrefix)
    setSplitPrefix(current => Math.max(nextPrefix, current))
  }

  const handleReset = () => {
    setAddress('192.168.10.42')
    setPrefix(24)
    setCandidate('192.168.10.99')
    setSplitPrefix(26)
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
            <div className="flex flex-wrap gap-3">
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

      {result && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                  value={result.totalAddresses.toLocaleString()}
                />
                <CidrMetric
                  label={t('app.converter.cidr.usable')}
                  value={result.usableAddresses.toLocaleString()}
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
                      setSplitPrefix(Math.min(32, Math.max(prefix, Number(event.target.value))))
                    }
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  {subnets.map(subnet => (
                    <div key={subnet.cidr} className="glass-input rounded-xl p-3">
                      <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {subnet.cidr}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
                        {subnet.network} - {subnet.broadcast} / {subnet.size.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
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
