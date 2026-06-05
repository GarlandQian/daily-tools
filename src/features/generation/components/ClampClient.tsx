'use client'

import { Copy, RefreshCw, Ruler, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

interface ClampFormData {
  minSize: number
  maxSize: number
  minViewport: number
  maxViewport: number
  rootSize: number
}

interface ClampPreset {
  key: string
  value: ClampFormData
}

const DEFAULT_FORM_DATA: ClampFormData = {
  minSize: 16,
  maxSize: 32,
  minViewport: 375,
  maxViewport: 1440,
  rootSize: 16
}

const CLAMP_PRESETS: ClampPreset[] = [
  {
    key: 'body',
    value: {
      minSize: 15,
      maxSize: 18,
      minViewport: 375,
      maxViewport: 1440,
      rootSize: 16
    }
  },
  {
    key: 'heading',
    value: {
      minSize: 28,
      maxSize: 56,
      minViewport: 375,
      maxViewport: 1440,
      rootSize: 16
    }
  },
  {
    key: 'space',
    value: {
      minSize: 16,
      maxSize: 48,
      minViewport: 375,
      maxViewport: 1280,
      rootSize: 16
    }
  }
]

const round = (value: number) => Number(value.toFixed(4))

const toRem = (px: number, rootSize: number) => `${round(px / rootSize)}rem`

const ClampClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [formData, setFormData] = useState<ClampFormData>(DEFAULT_FORM_DATA)

  const result = useMemo(() => {
    const viewportRange = formData.maxViewport - formData.minViewport

    if (
      viewportRange <= 0 ||
      formData.rootSize <= 0 ||
      formData.minSize < 0 ||
      formData.maxSize < 0
    ) {
      return null
    }

    const slope = (formData.maxSize - formData.minSize) / viewportRange
    const intercept = formData.minSize - slope * formData.minViewport
    const preferred = `${round(intercept / formData.rootSize)}rem + ${round(slope * 100)}vw`
    const css = `clamp(${toRem(formData.minSize, formData.rootSize)}, ${preferred}, ${toRem(
      formData.maxSize,
      formData.rootSize
    )})`
    const tailwind = `text-[${css.replaceAll(' ', '_')}]`

    return {
      css,
      tailwind,
      slope: round(slope),
      intercept: round(intercept)
    }
  }, [formData])

  const updateNumber = useCallback((key: keyof ClampFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: Number(value)
    }))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
  }, [])

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

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('app.generation.clamp')}</CardTitle>
              <CardDescription>{t('app.generation.clamp.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-3">
              <Label htmlFor="clamp-min-size">{t('app.generation.clamp.min_size')}</Label>
              <Input
                id="clamp-min-size"
                type="number"
                min={0}
                value={formData.minSize}
                onChange={event => updateNumber('minSize', event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-max-size">{t('app.generation.clamp.max_size')}</Label>
              <Input
                id="clamp-max-size"
                type="number"
                min={0}
                value={formData.maxSize}
                onChange={event => updateNumber('maxSize', event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-min-vw">{t('app.generation.clamp.min_viewport')}</Label>
              <Input
                id="clamp-min-vw"
                type="number"
                min={1}
                value={formData.minViewport}
                onChange={event => updateNumber('minViewport', event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-max-vw">{t('app.generation.clamp.max_viewport')}</Label>
              <Input
                id="clamp-max-vw"
                type="number"
                min={1}
                value={formData.maxViewport}
                onChange={event => updateNumber('maxViewport', event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="clamp-root">{t('app.generation.clamp.root_size')}</Label>
              <Input
                id="clamp-root"
                type="number"
                min={1}
                value={formData.rootSize}
                onChange={event => updateNumber('rootSize', event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CLAMP_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => setFormData(preset.value)}
              >
                {t(`app.generation.clamp.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[360px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>{t('app.generation.clamp.result')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <>
                <div className="space-y-3">
                  <Label>{t('app.generation.clamp.css_value')}</Label>
                  <div className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3">
                    <code className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--text-primary)]">
                      {result.css}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => void handleCopy(result.css)}
                      aria-label={t('public.copy')}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t('app.generation.clamp.tailwind_value')}</Label>
                  <div className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-4 py-3">
                    <code className="min-w-0 flex-1 break-all font-mono text-sm text-[var(--text-primary)]">
                      {result.tailwind}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => void handleCopy(result.tailwind)}
                      aria-label={t('public.copy')}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[var(--error)] bg-[var(--error-subtle)] p-6 text-center text-sm text-[var(--text-primary)]">
                {t('app.generation.clamp.invalid')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.clamp.preview')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="glass-panel glass-clip rounded-3xl p-5">
              <div
                className="font-semibold leading-tight text-[var(--text-primary)]"
                style={{ fontSize: result?.css ?? undefined }}
              >
                Daily Tools
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.clamp.preview_description')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Ruler className="h-4 w-4" />
                  {t('app.generation.clamp.slope')}
                </div>
                <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
                  {result?.slope ?? '-'}
                </div>
              </div>
              <div className="glass-panel glass-clip rounded-2xl p-4">
                <div className="text-xs text-[var(--text-secondary)]">
                  {t('app.generation.clamp.intercept')}
                </div>
                <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
                  {result?.intercept ?? '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ClampClient
