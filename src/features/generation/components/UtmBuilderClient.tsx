'use client'

import { Copy, Link2, Megaphone, RotateCcw, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useCopy } from '@/hooks/useCopy'

type UtmPresetKey = 'newsletter' | 'social' | 'paid' | 'partner'

interface UtmFormData {
  url: string
  source: string
  medium: string
  campaign: string
  term: string
  content: string
}

const DEFAULT_FORM_DATA: UtmFormData = {
  url: 'https://daily-tools.vercel.app',
  source: 'newsletter',
  medium: 'email',
  campaign: 'launch',
  term: '',
  content: ''
}

const PRESETS: Record<UtmPresetKey, Pick<UtmFormData, 'source' | 'medium' | 'campaign'>> = {
  newsletter: {
    source: 'newsletter',
    medium: 'email',
    campaign: 'monthly-update'
  },
  social: {
    source: 'twitter',
    medium: 'social',
    campaign: 'product-post'
  },
  paid: {
    source: 'google',
    medium: 'cpc',
    campaign: 'search-campaign'
  },
  partner: {
    source: 'partner',
    medium: 'referral',
    campaign: 'co-marketing'
  }
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const buildUtmUrl = (formData: UtmFormData) => {
  const normalized = normalizeUrl(formData.url)
  if (!normalized) return { error: null, query: '', url: '' }

  try {
    const url = new URL(normalized)
    const entries = [
      ['utm_source', formData.source],
      ['utm_medium', formData.medium],
      ['utm_campaign', formData.campaign],
      ['utm_term', formData.term],
      ['utm_content', formData.content]
    ] as const

    entries.forEach(([key, value]) => {
      if (value.trim()) {
        url.searchParams.set(key, value.trim())
      } else {
        url.searchParams.delete(key)
      }
    })

    return {
      error: null,
      query: url.searchParams.toString(),
      url: url.toString()
    }
  } catch {
    return { error: 'invalid', query: '', url: '' }
  }
}

const UtmBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<UtmFormData>(DEFAULT_FORM_DATA)

  const result = useMemo(() => buildUtmUrl(formData), [formData])
  const requiredMissing =
    !formData.source.trim() || !formData.medium.trim() || !formData.campaign.trim()
  const canCopy = Boolean(result.url && !result.error && !requiredMissing)

  const applyPreset = (key: UtmPresetKey) => {
    setFormData(prev => ({ ...prev, ...PRESETS[key] }))
  }

  const reset = () => {
    setFormData(DEFAULT_FORM_DATA)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.utm')}
              </CardTitle>
              <CardDescription>{t('app.generation.utm.description')}</CardDescription>
            </div>
            <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <Label htmlFor="utm-url">{t('app.generation.utm.url')}</Label>
              <Input
                id="utm-url"
                value={formData.url}
                onChange={event => setFormData(prev => ({ ...prev, url: event.target.value }))}
                placeholder="example.com/pricing"
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="utm-preset">{t('app.generation.utm.preset')}</Label>
              <Select
                id="utm-preset"
                defaultValue=""
                onChange={event => applyPreset(event.target.value as UtmPresetKey)}
              >
                <option value="" disabled>
                  {t('app.generation.utm.choose_preset')}
                </option>
                {(['newsletter', 'social', 'paid', 'partner'] as const).map(key => (
                  <option key={key} value={key}>
                    {t(`app.generation.utm.preset.${key}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UtmInput
              id="utm-source"
              label={t('app.generation.utm.source')}
              value={formData.source}
              onChange={value => setFormData(prev => ({ ...prev, source: value }))}
              placeholder="newsletter"
              required
            />
            <UtmInput
              id="utm-medium"
              label={t('app.generation.utm.medium')}
              value={formData.medium}
              onChange={value => setFormData(prev => ({ ...prev, medium: value }))}
              placeholder="email"
              required
            />
            <UtmInput
              id="utm-campaign"
              label={t('app.generation.utm.campaign')}
              value={formData.campaign}
              onChange={value => setFormData(prev => ({ ...prev, campaign: value }))}
              placeholder="launch"
              required
            />
            <UtmInput
              id="utm-term"
              label={t('app.generation.utm.term')}
              value={formData.term}
              onChange={value => setFormData(prev => ({ ...prev, term: value }))}
              placeholder="keyword"
            />
            <UtmInput
              id="utm-content"
              label={t('app.generation.utm.content')}
              value={formData.content}
              onChange={value => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="button-a"
            />
          </div>

          {requiredMissing && (
            <p className="text-sm text-[var(--warning)]">{t('app.generation.utm.required')}</p>
          )}
          {result.error && (
            <p className="text-sm text-[var(--error)]">{t('app.generation.utm.invalid')}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[320px] flex-col overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.utm.result')}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!canCopy}
                  onClick={() => copy(result.url)}
                >
                  {t('public.copy')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canCopy}
                  onClick={() => copy(result.query)}
                >
                  {t('app.generation.utm.copy_query')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {canCopy ? (
              <div className="glass-input rounded-2xl p-4">
                <code className="break-all font-mono text-sm leading-6 text-[var(--text-primary)]">
                  {result.url}
                </code>
              </div>
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center text-center">
                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.generation.utm.empty')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.utm.summary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['utm_source', formData.source],
              ['utm_medium', formData.medium],
              ['utm_campaign', formData.campaign],
              ['utm_term', formData.term],
              ['utm_content', formData.content]
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2.5"
              >
                <span className="font-mono text-xs text-[var(--text-tertiary)]">{key}</span>
                <span className="min-w-0 truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {value || '-'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const UtmInput = ({
  id,
  label,
  onChange,
  placeholder,
  required,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>
      {label}
      {required ? <span className="ml-1 text-[var(--warning)]">*</span> : null}
    </Label>
    <Input
      id={id}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="font-mono"
    />
  </div>
)

export default UtmBuilderClient
