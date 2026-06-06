'use client'

import {
  camelCase,
  kebabCase,
  lowerCase,
  snakeCase,
  startCase,
  toLower,
  toUpper,
  upperFirst
} from 'lodash-es'
import { Copy, Sparkles, Trash2, Type } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface Conversion {
  label: string
  value: string
  hint: string
}

const toSentenceCase = (value: string) => upperFirst(lowerCase(value))
const toHeaderCase = (value: string) => startCase(camelCase(value)).replaceAll(' ', '-')
const toPathCase = (value: string) => lowerCase(value).replaceAll(' ', '/')
const toDotCase = (value: string) => lowerCase(value).replaceAll(' ', '.')

const CaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const deferredInput = useDeferredValue(input)

  const conversions = useMemo<Conversion[]>(() => {
    if (!deferredInput.trim()) return []

    const text = deferredInput.trim()
    const titleCase = startCase(camelCase(text))
    const kebab = kebabCase(text)
    const snake = snakeCase(text)

    return [
      { label: 'camelCase', value: camelCase(text), hint: 'JavaScript variables' },
      { label: 'PascalCase', value: upperFirst(camelCase(text)), hint: 'React components' },
      { label: 'snake_case', value: snake, hint: 'Database fields' },
      { label: 'kebab-case', value: kebab, hint: 'URLs and CSS classes' },
      { label: 'CONSTANT_CASE', value: toUpper(snake), hint: 'Environment constants' },
      { label: 'SCREAMING-KEBAB', value: toUpper(kebab), hint: 'Legacy config keys' },
      { label: 'Train-Case', value: toHeaderCase(text), hint: 'Headers and labels' },
      { label: 'dot.case', value: toDotCase(text), hint: 'Config paths' },
      { label: 'path/case', value: toPathCase(text), hint: 'Route fragments' },
      { label: 'Title Case', value: titleCase, hint: 'Headings' },
      { label: 'Sentence case', value: toSentenceCase(text), hint: 'Human copy' },
      { label: 'UPPER CASE', value: toUpper(text), hint: 'Shouting text' },
      { label: 'lower case', value: toLower(text), hint: 'Normalized text' },
      { label: 'slug', value: kebab, hint: 'SEO-friendly slug' }
    ]
  }, [deferredInput])

  const copyAll = () => {
    void copy(conversions.map(item => `${item.label}: ${item.value}`).join('\n'))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.case')}
              </CardTitle>
              <CardDescription>{t('app.format.case.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={copyAll}
                disabled={!conversions.length}
              >
                {t('app.format.case.copy_all')}
              </Button>
              <Button icon={<Trash2 className="h-4 w-4" />} onClick={() => setInput('')}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={t('app.format.case.placeholder')}
            rows={4}
            className="font-mono"
          />
        </CardContent>
      </Card>

      {conversions.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {conversions.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => copy(item.value)}
              className="glass-panel glass-clip group min-h-32 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:glass-panel-strong"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                    {item.label}
                  </span>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">{item.hint}</p>
                </div>
                <Copy className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="break-all font-mono text-sm leading-6 text-[var(--text-primary)]">
                {item.value}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <Card className="glass-panel-static">
          <CardContent className="flex min-h-44 items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <Sparkles className="mx-auto h-8 w-8 text-[var(--primary)]" />
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.format.case.empty')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CaseClient
