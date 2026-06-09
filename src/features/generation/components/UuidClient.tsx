'use client'

import { Copy, FileJson2, KeyRound, RotateCcw, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v1, v3, v4, v5, validate as validateUuid } from 'uuid'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type UUIDVersion = 'v1' | 'v3' | 'v4' | 'v5'
type UUIDNamespacePreset = 'dns' | 'url' | 'oid' | 'x500'

interface UUIDPreset {
  key: string
  name: string
  namespace: string
  quantity: number
  version: UUIDVersion
}

const UUID_NAMESPACE_PRESETS: Record<UUIDNamespacePreset, string> = {
  dns: v5.DNS,
  url: v5.URL,
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'
}

const UUID_PRESETS: UUIDPreset[] = [
  {
    key: 'random',
    name: '',
    namespace: UUID_NAMESPACE_PRESETS.dns,
    quantity: 8,
    version: 'v4'
  },
  {
    key: 'dns',
    name: 'daily-tools.dev',
    namespace: UUID_NAMESPACE_PRESETS.dns,
    quantity: 5,
    version: 'v5'
  },
  {
    key: 'time',
    name: '',
    namespace: UUID_NAMESPACE_PRESETS.dns,
    quantity: 12,
    version: 'v1'
  }
]

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

const formatUuidValue = (uuid: string, uppercase: boolean, hyphenless: boolean) => {
  const formatted = hyphenless ? uuid.replaceAll('-', '') : uuid
  return uppercase ? formatted.toUpperCase() : formatted
}

const UuidClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()
  const [result, setResult] = useState<string[]>([])
  const [version, setVersion] = useState<UUIDVersion>('v4')
  const [quantity, setQuantity] = useState(8)
  const [namespace, setNamespace] = useState(UUID_NAMESPACE_PRESETS.dns)
  const [name, setName] = useState('')
  const [uppercase, setUppercase] = useState(false)
  const [hyphenless, setHyphenless] = useState(false)

  const normalizedQuantity = clampNumber(quantity, 1, 1000)
  const requiresNamespace = version === 'v3' || version === 'v5'
  const canGenerate = !requiresNamespace || (validateUuid(namespace) && name.trim().length > 0)
  const formattedResult = useMemo(
    () => result.map(uuid => formatUuidValue(uuid, uppercase, hyphenless)),
    [hyphenless, result, uppercase]
  )
  const resultText = formattedResult.join('\n')
  const resultJson = useMemo(() => JSON.stringify(formattedResult, null, 2), [formattedResult])

  const validationMessage = useMemo(() => {
    if (!requiresNamespace) return ''
    if (!validateUuid(namespace)) return t('app.generation.uuid.invalid_namespace')
    if (!name.trim()) return t('app.generation.uuid.name_required')
    return ''
  }, [name, namespace, requiresNamespace, t])

  const handleGenerate = useCallback(() => {
    if (!canGenerate) {
      toast.warning(validationMessage)
      return
    }

    const nextUuids = Array.from({ length: normalizedQuantity }, () => {
      if (version === 'v1') return v1()
      if (version === 'v3') return v3(name.trim(), namespace)
      if (version === 'v5') return v5(name.trim(), namespace)
      return v4()
    })

    setResult(nextUuids)
    toast.success(t('public.success'))
  }, [canGenerate, name, namespace, normalizedQuantity, toast, t, validationMessage, version])

  const handleApplyPreset = useCallback((preset: UUIDPreset) => {
    setVersion(preset.version)
    setQuantity(preset.quantity)
    setNamespace(preset.namespace)
    setName(preset.name)
    setResult([])
  }, [])

  const handleReset = useCallback(() => {
    setVersion('v4')
    setQuantity(8)
    setNamespace(UUID_NAMESPACE_PRESETS.dns)
    setName('')
    setUppercase(false)
    setHyphenless(false)
    setResult([])
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.uuid')}
              </CardTitle>
              <CardDescription>{t('app.generation.uuid.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {UUID_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="ghost"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={() => handleApplyPreset(preset)}
              >
                {t(`app.generation.uuid.preset.${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="uuid-version">{t('app.generation.uuid.version')}</Label>
                <Select
                  id="uuid-version"
                  value={version}
                  onChange={event => setVersion(event.target.value as UUIDVersion)}
                >
                  <option value="v1">{t('app.generation.uuid.v1')}</option>
                  <option value="v3">{t('app.generation.uuid.v3')}</option>
                  <option value="v4">{t('app.generation.uuid.v4')}</option>
                  <option value="v5">{t('app.generation.uuid.v5')}</option>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="uuid-quantity">{t('app.generation.uuid.quantity')}</Label>
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {normalizedQuantity}
                  </span>
                </div>
                <Slider
                  id="uuid-quantity"
                  min={1}
                  max={1000}
                  value={normalizedQuantity}
                  onChange={setQuantity}
                />
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={quantity}
                  onChange={event => setQuantity(Number(event.target.value))}
                />
              </div>

              {requiresNamespace && (
                <>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="uuid-namespace">{t('app.generation.uuid.namespace')}</Label>
                    <Input
                      id="uuid-namespace"
                      value={namespace}
                      onChange={event => setNamespace(event.target.value)}
                      aria-invalid={!validateUuid(namespace)}
                      placeholder={t('app.generation.uuid.ns_placeholder')}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(UUID_NAMESPACE_PRESETS) as UUIDNamespacePreset[]).map(
                        preset => (
                          <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setNamespace(UUID_NAMESPACE_PRESETS[preset])}
                          >
                            {t(`app.generation.uuid.namespace.${preset}`)}
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="uuid-name">{t('app.generation.uuid.name')}</Label>
                    <Input
                      id="uuid-name"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      aria-invalid={!name.trim()}
                      placeholder={t('app.generation.uuid.name_placeholder')}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="glass-input rounded-xl p-3">
                <Checkbox
                  checked={uppercase}
                  onChange={event => setUppercase(event.target.checked)}
                  label={t('app.generation.uuid.uppercase')}
                />
                <Checkbox
                  checked={hyphenless}
                  onChange={event => setHyphenless(event.target.checked)}
                  label={t('app.generation.uuid.hyphenless')}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <UuidMetric
                  label={t('app.generation.uuid.stats.count')}
                  value={String(formattedResult.length)}
                />
                <UuidMetric label={t('app.generation.uuid.stats.version')} value={version} />
                <UuidMetric
                  label={t('app.generation.uuid.stats.mode')}
                  value={
                    requiresNamespace
                      ? t('app.generation.uuid.stats.namespace')
                      : t('app.generation.uuid.stats.random')
                  }
                />
              </div>

              {validationMessage && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {validationMessage}
                </p>
              )}

              <Button
                variant="primary"
                icon={<RotateCcw className="h-4 w-4" />}
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {t('public.generate')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[360px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('app.generation.uuid.result')}</CardTitle>
              <CardDescription>{t('app.generation.uuid.result_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<Copy className="h-4 w-4" />}
                disabled={!resultText}
                onClick={() => copy(resultText)}
              >
                {t('app.generation.uuid.copy')}
              </Button>
              <Button
                variant="ghost"
                icon={<FileJson2 className="h-4 w-4" />}
                disabled={!formattedResult.length}
                onClick={() => copy(resultJson)}
              >
                {t('app.generation.uuid.copy_json')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={resultText}
              className="min-h-[320px] flex-1 resize-none font-mono"
              readOnly
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.uuid.rows')}</CardTitle>
            <CardDescription>{t('app.generation.uuid.rows_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
            {formattedResult.length ? (
              formattedResult.map((uuid, index) => (
                <div key={`${uuid}-${index}`} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <code className="min-w-0 break-all text-sm text-[var(--text-primary)]">
                      {uuid}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => copy(uuid)}
                    >
                      {t('public.copy')}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] px-4 text-center text-sm text-[var(--text-tertiary)]">
                <Sparkles className="mb-3 h-6 w-6 text-[var(--text-tertiary)]" />
                {t('app.generation.uuid.empty')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const UuidMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

export default UuidClient
