'use client'

import {
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileJson,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type PasswordMode = 'passphrase' | 'password'
type PasswordOutput = 'csv' | 'json' | 'lines'

interface PasswordFormData {
  count: number
  customSymbols: string
  excludeAmbiguous: boolean
  length: number
  lowercase: boolean
  mode: PasswordMode
  numbers: boolean
  passphraseSeparator: string
  passphraseWords: number
  requireEachType: boolean
  symbols: boolean
  uppercase: boolean
}

interface PasswordPreset {
  key: string
  value: PasswordFormData
}

const DEFAULT_FORM_DATA: PasswordFormData = {
  count: 5,
  customSymbols: '!@#$%^&*_-+=?',
  excludeAmbiguous: true,
  length: 18,
  lowercase: true,
  mode: 'password',
  numbers: true,
  passphraseSeparator: '-',
  passphraseWords: 4,
  requireEachType: true,
  symbols: true,
  uppercase: true
}

const PASSWORD_PRESETS: PasswordPreset[] = [
  {
    key: 'strong',
    value: DEFAULT_FORM_DATA
  },
  {
    key: 'memorable',
    value: {
      ...DEFAULT_FORM_DATA,
      excludeAmbiguous: true,
      length: 16,
      symbols: false
    }
  },
  {
    key: 'pin',
    value: {
      ...DEFAULT_FORM_DATA,
      count: 10,
      length: 6,
      lowercase: false,
      numbers: true,
      requireEachType: false,
      symbols: false,
      uppercase: false
    }
  },
  {
    key: 'passphrase',
    value: {
      ...DEFAULT_FORM_DATA,
      count: 6,
      mode: 'passphrase',
      passphraseSeparator: '-',
      passphraseWords: 4,
      requireEachType: false,
      symbols: false
    }
  },
  {
    key: 'wifi',
    value: {
      ...DEFAULT_FORM_DATA,
      count: 4,
      customSymbols: '!@#$%+=?',
      length: 24
    }
  }
]

const BASE_CHAR_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
}

const AMBIGUOUS_CHARS = new Set(['0', 'O', 'o', '1', 'I', 'l', '|'])
const PASSPHRASE_WORDS = [
  'anchor',
  'amber',
  'binary',
  'breeze',
  'carbon',
  'cobalt',
  'delta',
  'ember',
  'forest',
  'galaxy',
  'harbor',
  'indigo',
  'jupiter',
  'kernel',
  'lantern',
  'matrix',
  'nebula',
  'orbit',
  'pixel',
  'quartz',
  'rocket',
  'silver',
  'tidal',
  'vector',
  'willow',
  'zenith'
]
const UINT32_RANGE = 0x100000000
const MAX_PASSWORD_VISIBLE_ROWS = 40
const MAX_PASSWORD_EXPORT_PREVIEW_ROWS = 40

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

const uniqueChars = (value: string) => Array.from(new Set(value.split(''))).join('')

const removeAmbiguous = (value: string) =>
  value
    .split('')
    .filter(char => !AMBIGUOUS_CHARS.has(char))
    .join('')

const getRandomIndex = (max: number) => {
  const limit = Math.floor(UINT32_RANGE / max) * max
  const array = new Uint32Array(1)

  do {
    crypto.getRandomValues(array)
  } while (array[0] >= limit)

  return array[0] % max
}

const pickRandomChar = (charset: string) => charset[getRandomIndex(charset.length)]

const shuffleChars = (chars: string[]) => {
  const next = [...chars]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1)
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }

  return next
}

const getStrengthLevel = (entropyBits: number) => {
  if (entropyBits >= 120) return 'excellent'
  if (entropyBits >= 90) return 'strong'
  if (entropyBits >= 60) return 'fair'
  return 'weak'
}

const buildSelectedGroups = (formData: PasswordFormData) => {
  const transform = formData.excludeAmbiguous ? removeAmbiguous : (value: string) => value
  const groups: string[] = []

  if (formData.uppercase) groups.push(transform(BASE_CHAR_SETS.uppercase))
  if (formData.lowercase) groups.push(transform(BASE_CHAR_SETS.lowercase))
  if (formData.numbers) groups.push(transform(BASE_CHAR_SETS.numbers))
  if (formData.symbols) groups.push(transform(uniqueChars(formData.customSymbols)))

  return groups.filter(Boolean)
}

const generatePassword = (length: number, groups: string[], requireEachType: boolean) => {
  const charset = uniqueChars(groups.join(''))
  const chars: string[] = []

  if (requireEachType) {
    groups.forEach(group => chars.push(pickRandomChar(group)))
  }

  while (chars.length < length) {
    chars.push(pickRandomChar(charset))
  }

  return shuffleChars(chars).join('')
}

const generatePassphrase = (wordCount: number, separator: string) =>
  Array.from(
    { length: wordCount },
    () => PASSPHRASE_WORDS[getRandomIndex(PASSPHRASE_WORDS.length)]
  ).join(separator || '-')

const formatPasswordOutput = (
  passwords: string[],
  outputType: PasswordOutput,
  entropyBits: number,
  strengthLevel: string
) => {
  if (outputType === 'json') {
    return JSON.stringify(
      passwords.map((password, index) => ({
        entropyBits,
        index: index + 1,
        password,
        strength: strengthLevel
      })),
      null,
      2
    )
  }

  if (outputType === 'csv') {
    return [
      'index,password,entropyBits,strength',
      ...passwords.map(
        (password, index) =>
          `${index + 1},"${password.replaceAll('"', '""')}",${entropyBits},${strengthLevel}`
      )
    ].join('\n')
  }

  return passwords.join('\n')
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

const PasswordClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<PasswordFormData>(DEFAULT_FORM_DATA)
  const [outputType, setOutputType] = useState<PasswordOutput>('lines')
  const [passwords, setPasswords] = useState<string[]>([])
  const [showSecrets, setShowSecrets] = useState(false)

  const normalizedLength = clampNumber(formData.length, 4, 128)
  const normalizedCount = clampNumber(formData.count, 1, 100)
  const normalizedPassphraseWords = clampNumber(formData.passphraseWords, 3, 10)
  const selectedGroups = useMemo(() => buildSelectedGroups(formData), [formData])
  const charset = useMemo(() => uniqueChars(selectedGroups.join('')), [selectedGroups])
  const entropyBits = useMemo(() => {
    if (formData.mode === 'passphrase') {
      return Math.floor(normalizedPassphraseWords * Math.log2(PASSPHRASE_WORDS.length))
    }
    if (!charset.length) return 0
    return Math.floor(normalizedLength * Math.log2(charset.length))
  }, [charset.length, formData.mode, normalizedLength, normalizedPassphraseWords])
  const strengthLevel = getStrengthLevel(entropyBits)
  const visiblePasswords = useMemo(() => passwords.slice(0, MAX_PASSWORD_VISIBLE_ROWS), [passwords])
  const exportPreviewPasswords = useMemo(() => {
    const previewPasswords = passwords.slice(0, MAX_PASSWORD_EXPORT_PREVIEW_ROWS)

    if (showSecrets) return previewPasswords
    return previewPasswords.map(password => '*'.repeat(Math.min(password.length, 32)))
  }, [passwords, showSecrets])
  const exportPreview = useMemo(
    () => formatPasswordOutput(exportPreviewPasswords, outputType, entropyBits, strengthLevel),
    [entropyBits, exportPreviewPasswords, outputType, strengthLevel]
  )
  const isRowPreviewLimited = passwords.length > visiblePasswords.length
  const isExportPreviewLimited = passwords.length > exportPreviewPasswords.length
  const policyHints = useMemo(() => {
    const hints: string[] = []

    if (entropyBits < 90) hints.push(t('app.generation.password.hint.entropy'))
    if (formData.mode === 'password' && !formData.excludeAmbiguous) {
      hints.push(t('app.generation.password.hint.ambiguous'))
    }
    if (formData.mode === 'password' && formData.symbols && !formData.customSymbols.trim()) {
      hints.push(t('app.generation.password.hint.symbols'))
    }
    if (formData.mode === 'passphrase' && normalizedPassphraseWords < 4) {
      hints.push(t('app.generation.password.hint.words'))
    }

    return hints
  }, [
    entropyBits,
    formData.customSymbols,
    formData.excludeAmbiguous,
    formData.mode,
    formData.symbols,
    normalizedPassphraseWords,
    t
  ])

  const handleGenerate = useCallback(() => {
    if (formData.mode === 'password' && !charset.length) {
      toast.warning(t('app.generation.password.no_charset'))
      return
    }

    if (
      formData.mode === 'password' &&
      formData.requireEachType &&
      normalizedLength < selectedGroups.length
    ) {
      toast.warning(t('app.generation.password.too_short'))
      return
    }

    const nextPasswords = Array.from({ length: normalizedCount }, () => {
      if (formData.mode === 'passphrase') {
        return generatePassphrase(normalizedPassphraseWords, formData.passphraseSeparator)
      }
      return generatePassword(normalizedLength, selectedGroups, formData.requireEachType)
    })

    setPasswords(nextPasswords)
    setShowSecrets(true)
    toast.success(t('public.success'))
  }, [
    charset.length,
    formData.mode,
    formData.passphraseSeparator,
    formData.requireEachType,
    normalizedCount,
    normalizedLength,
    normalizedPassphraseWords,
    selectedGroups,
    toast,
    t
  ])

  const handleCopyAll = useCallback(() => {
    if (!passwords.length) return
    void copy(formatPasswordOutput(passwords, outputType, entropyBits, strengthLevel))
  }, [copy, entropyBits, outputType, passwords, strengthLevel])

  const handleDownload = useCallback(() => {
    if (!passwords.length) return
    const extension = outputType === 'json' ? 'json' : outputType === 'csv' ? 'csv' : 'txt'
    const mime =
      outputType === 'json'
        ? 'application/json;charset=utf-8'
        : outputType === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'text/plain;charset=utf-8'

    downloadText(
      formatPasswordOutput(passwords, outputType, entropyBits, strengthLevel),
      `daily-tools-passwords.${extension}`,
      mime
    )
  }, [entropyBits, outputType, passwords, strengthLevel])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle>{t('app.generation.password')}</CardTitle>
            <CardDescription>{t('app.generation.password.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="password-mode">{t('app.generation.password.mode')}</Label>
                <Select
                  id="password-mode"
                  value={formData.mode}
                  onChange={event =>
                    setFormData(prev => ({ ...prev, mode: event.target.value as PasswordMode }))
                  }
                >
                  <option value="password">{t('app.generation.password.mode.password')}</option>
                  <option value="passphrase">{t('app.generation.password.mode.passphrase')}</option>
                </Select>
              </div>

              <div className="space-y-3">
                {formData.mode === 'password' ? (
                  <>
                    <Label>
                      {t('app.generation.password.length')}: {normalizedLength}
                    </Label>
                    <Slider
                      value={normalizedLength}
                      min={4}
                      max={128}
                      onChange={value => setFormData(prev => ({ ...prev, length: value }))}
                    />
                  </>
                ) : (
                  <>
                    <Label>
                      {t('app.generation.password.words')}: {normalizedPassphraseWords}
                    </Label>
                    <Slider
                      value={normalizedPassphraseWords}
                      min={3}
                      max={10}
                      onChange={value => setFormData(prev => ({ ...prev, passphraseWords: value }))}
                    />
                  </>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="count">{t('app.generation.password.count')}</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.count}
                  onChange={event =>
                    setFormData(prev => ({ ...prev, count: Number(event.target.value) }))
                  }
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="custom-symbols">
                  {formData.mode === 'password'
                    ? t('app.generation.password.custom_symbols')
                    : t('app.generation.password.separator')}
                </Label>
                <Input
                  id="custom-symbols"
                  value={
                    formData.mode === 'password'
                      ? formData.customSymbols
                      : formData.passphraseSeparator
                  }
                  onChange={event =>
                    setFormData(prev =>
                      formData.mode === 'password'
                        ? { ...prev, customSymbols: event.target.value }
                        : { ...prev, passphraseSeparator: event.target.value.slice(0, 3) }
                    )
                  }
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <Metric
                icon={<ShieldCheck className="h-4 w-4" />}
                label={t('app.generation.password.entropy')}
                value={entropyBits}
              />
              <Metric label={t('app.generation.password.charset_size')} value={charset.length} />
              <Metric
                icon={<KeyRound className="h-4 w-4" />}
                label={t('app.generation.password.strength')}
                value={t(`app.generation.password.strength.${strengthLevel}`)}
              />
            </div>
          </div>

          {formData.mode === 'password' && (
            <>
              <div className="space-y-3">
                <Label>{t('app.generation.password.charset')}</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Checkbox
                    checked={formData.uppercase}
                    onChange={event =>
                      setFormData(prev => ({ ...prev, uppercase: event.target.checked }))
                    }
                    label={t('app.generation.password.uppercase')}
                  />
                  <Checkbox
                    checked={formData.lowercase}
                    onChange={event =>
                      setFormData(prev => ({ ...prev, lowercase: event.target.checked }))
                    }
                    label={t('app.generation.password.lowercase')}
                  />
                  <Checkbox
                    checked={formData.numbers}
                    onChange={event =>
                      setFormData(prev => ({ ...prev, numbers: event.target.checked }))
                    }
                    label={t('app.generation.password.numbers')}
                  />
                  <Checkbox
                    checked={formData.symbols}
                    onChange={event =>
                      setFormData(prev => ({ ...prev, symbols: event.target.checked }))
                    }
                    label={t('app.generation.password.symbols')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Checkbox
                  checked={formData.requireEachType}
                  onChange={event =>
                    setFormData(prev => ({ ...prev, requireEachType: event.target.checked }))
                  }
                  label={t('app.generation.password.require_each')}
                />
                <Checkbox
                  checked={formData.excludeAmbiguous}
                  onChange={event =>
                    setFormData(prev => ({ ...prev, excludeAmbiguous: event.target.checked }))
                  }
                  label={t('app.generation.password.exclude_ambiguous')}
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {PASSWORD_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => setFormData(preset.value)}
              >
                {t(`app.generation.password.preset.${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleGenerate}
            >
              {t('public.generate')}
            </Button>
            <Button
              icon={<Copy className="h-4 w-4" />}
              onClick={handleCopyAll}
              disabled={!passwords.length}
            >
              {t('app.generation.password.copy_all')}
            </Button>
            <Button
              type="button"
              variant="default"
              icon={<FileDown className="h-4 w-4" />}
              onClick={handleDownload}
              disabled={!passwords.length}
            >
              {t('app.generation.password.download')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              icon={showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              onClick={() => setShowSecrets(prev => !prev)}
            >
              {showSecrets
                ? t('app.generation.password.hide')
                : t('app.generation.password.reveal')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.generation.password.result')}</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="password-output" className="text-xs">
                {t('app.generation.password.output')}
              </Label>
              <Select
                id="password-output"
                value={outputType}
                onChange={event => setOutputType(event.target.value as PasswordOutput)}
                className="w-36"
              >
                <option value="lines">{t('app.generation.password.output.lines')}</option>
                <option value="json">{t('app.generation.password.output.json')}</option>
                <option value="csv">{t('app.generation.password.output.csv')}</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {policyHints.length > 0 && (
            <div className="mb-4 grid gap-2">
              {policyHints.map(hint => (
                <div
                  key={hint}
                  className="rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {hint}
                </div>
              ))}
            </div>
          )}

          {passwords.length ? (
            <div className="flex flex-col gap-3">
              {visiblePasswords.map((password, index) => (
                <div
                  key={`${password}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3"
                >
                  <code className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--text-primary)]">
                    {showSecrets ? password : '*'.repeat(Math.min(password.length, 32))}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={() => void copy(password)}
                    aria-label={t('public.copy')}
                  />
                </div>
              ))}

              {isRowPreviewLimited && (
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {t('app.generation.password.rows_limited', {
                    total: passwords.length,
                    visible: visiblePasswords.length
                  })}
                </div>
              )}

              <div className="glass-input rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                  <FileJson className="h-4 w-4" />
                  {t('app.generation.password.export_preview')}
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                  {exportPreview}
                </pre>
                {isExportPreviewLimited && (
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                    {t('app.generation.password.preview_limited', {
                      total: passwords.length,
                      visible: exportPreviewPasswords.length
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-44 items-center justify-center text-center">
              <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.password.empty')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

export default PasswordClient
