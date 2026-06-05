'use client'

import { Copy, KeyRound, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/toast'

interface PasswordFormData {
  length: number
  count: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  requireEachType: boolean
  excludeAmbiguous: boolean
  customSymbols: string
}

interface PasswordPreset {
  key: string
  value: PasswordFormData
}

const DEFAULT_FORM_DATA: PasswordFormData = {
  length: 18,
  count: 5,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  requireEachType: true,
  excludeAmbiguous: true,
  customSymbols: '!@#$%^&*_-+=?'
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
      length: 16,
      symbols: false,
      excludeAmbiguous: true
    }
  },
  {
    key: 'pin',
    value: {
      ...DEFAULT_FORM_DATA,
      length: 6,
      count: 10,
      uppercase: false,
      lowercase: false,
      numbers: true,
      symbols: false,
      requireEachType: false
    }
  }
]

const BASE_CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789'
}

const AMBIGUOUS_CHARS = new Set(['0', 'O', 'o', '1', 'I', 'l', '|'])
const UINT32_RANGE = 0x100000000

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

const PasswordClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [passwords, setPasswords] = useState<string[]>([])
  const [formData, setFormData] = useState<PasswordFormData>(DEFAULT_FORM_DATA)

  const normalizedLength = clampNumber(formData.length, 4, 128)
  const normalizedCount = clampNumber(formData.count, 1, 100)
  const selectedGroups = useMemo(() => buildSelectedGroups(formData), [formData])
  const charset = useMemo(() => uniqueChars(selectedGroups.join('')), [selectedGroups])
  const entropyBits = useMemo(() => {
    if (!charset.length) return 0
    return Math.floor(normalizedLength * Math.log2(charset.length))
  }, [charset.length, normalizedLength])
  const strengthLevel = getStrengthLevel(entropyBits)

  const handleGenerate = useCallback(() => {
    if (!charset.length) {
      toast.warning(t('app.generation.password.no_charset'))
      return
    }

    if (formData.requireEachType && normalizedLength < selectedGroups.length) {
      toast.warning(t('app.generation.password.too_short'))
      return
    }

    const nextPasswords = Array.from({ length: normalizedCount }, () =>
      generatePassword(normalizedLength, selectedGroups, formData.requireEachType)
    )

    setPasswords(nextPasswords)
    toast.success(t('public.success'))
  }, [
    charset.length,
    formData.requireEachType,
    normalizedCount,
    normalizedLength,
    selectedGroups,
    toast,
    t
  ])

  const handleCopy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.success(t('public.copy.success'))
      } catch {
        toast.error(t('public.error'))
      }
    },
    [toast, t]
  )

  const handleCopyAll = useCallback(() => {
    if (!passwords.length) return
    void handleCopy(passwords.join('\n'))
  }, [handleCopy, passwords])

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
                <Label>
                  {t('app.generation.password.length')}: {normalizedLength}
                </Label>
                <Slider
                  value={normalizedLength}
                  min={4}
                  max={128}
                  onChange={value => setFormData(prev => ({ ...prev, length: value }))}
                />
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
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="custom-symbols">
                  {t('app.generation.password.custom_symbols')}
                </Label>
                <Input
                  id="custom-symbols"
                  value={formData.customSymbols}
                  onChange={event =>
                    setFormData(prev => ({ ...prev, customSymbols: event.target.value }))
                  }
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <ShieldCheck className="h-4 w-4" />
                  {t('app.generation.password.entropy')}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                  {entropyBits}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {t('app.generation.password.charset_size')}
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">
                  {charset.length}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <KeyRound className="h-4 w-4" />
                  {t('app.generation.password.strength')}
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.password.strength.${strengthLevel}`)}
                </div>
              </div>
            </div>
          </div>

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
              {t('app.generation.uuid.copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[260px] flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('app.generation.password.result')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {passwords.length ? (
            <div className="flex flex-col gap-3">
              {passwords.map((password, index) => (
                <div
                  key={`${password}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3"
                >
                  <code className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--text-primary)]">
                    {password}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={() => void handleCopy(password)}
                    aria-label={t('public.copy')}
                  />
                </div>
              ))}
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

export default PasswordClient
