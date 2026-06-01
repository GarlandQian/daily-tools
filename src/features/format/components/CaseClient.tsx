'use client'

import {
  camelCase,
  kebabCase,
  lowerCase,
  snakeCase,
  startCase,
  toUpper,
  upperFirst
} from 'lodash-es'
import { Copy, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const CaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')

  const conversions = useMemo(() => {
    if (!input.trim()) return []

    const text = input.trim()

    return [
      { label: 'camelCase', value: camelCase(text) },
      { label: 'PascalCase', value: upperFirst(camelCase(text)) },
      { label: 'snake_case', value: snakeCase(text) },
      { label: 'kebab-case', value: kebabCase(text) },
      { label: 'CONSTANT_CASE', value: snakeCase(text).toUpperCase() },
      { label: 'UPPER CASE', value: toUpper(text) },
      { label: 'lower case', value: lowerCase(text) },
      { label: 'Title Case', value: startCase(camelCase(text)) },
      { label: 'Sentence case', value: upperFirst(lowerCase(text)) },
      { label: 'Dot Case', value: lowerCase(text).replace(/ /g, '.') },
      { label: 'Path Case', value: lowerCase(text).replace(/ /g, '/') }
    ]
  }, [input])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('app.format.case')}</CardTitle>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={() => setInput('')}>
              {t('app.format.json.clear')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('app.format.case.placeholder')}
            rows={3}
            className="font-mono"
          />
        </CardContent>
      </Card>

      {conversions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {conversions.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => copy(item.value)}
              className="glass-panel rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:glass-panel-strong group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--primary-subtle)] text-[var(--primary)]">
                  {item.label}
                </span>
                <Copy className="w-3.5 h-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p
                className="font-mono text-sm text-[var(--text-primary)] truncate"
                title={item.value}
              >
                {item.value}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CaseClient
