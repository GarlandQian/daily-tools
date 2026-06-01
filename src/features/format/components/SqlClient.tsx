'use client'

import { Copy, Paintbrush, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'sql-formatter'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

type SqlLanguage =
  | 'sql'
  | 'mysql'
  | 'postgresql'
  | 'sqlite'
  | 'mariadb'
  | 'bigquery'
  | 'snowflake'
  | 'hive'

type KeywordCase = 'upper' | 'lower' | 'preserve'

const languageOptions: { label: string; value: SqlLanguage }[] = [
  { label: 'Standard SQL', value: 'sql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'BigQuery', value: 'bigquery' },
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'Hive', value: 'hive' }
]

const caseOptions: { label: string; value: KeywordCase }[] = [
  { label: 'UPPER', value: 'upper' },
  { label: 'lower', value: 'lower' },
  { label: 'Preserve', value: 'preserve' }
]

const SqlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [language, setLanguage] = useState<SqlLanguage>('sql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('upper')
  const [error, setError] = useState<string | null>(null)

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.sql.empty'))
      return
    }
    try {
      const formatted = format(input, {
        language,
        keywordCase,
        tabWidth: 2
      })
      setOutput(formatted)
      setError(null)
      toast.success(t('public.success'))
    } catch (e) {
      const err = e as Error
      setError(err.message)
      setOutput('')
    }
  }, [input, language, keywordCase, toast, t])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t('app.format.sql')}</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[220px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Label htmlFor="sql-dialect" className="text-xs text-[var(--text-secondary)]">
                  {t('app.format.sql.dialect')}
                </Label>
                <Select
                  id="sql-dialect"
                  value={language}
                  onChange={e => setLanguage(e.target.value as SqlLanguage)}
                  className="w-full sm:w-[150px]"
                >
                  {languageOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div
                className="glass-input inline-flex items-center rounded-lg p-0.5"
                role="radiogroup"
                aria-label={t('app.format.sql.keyword_case')}
              >
                {caseOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={keywordCase === opt.value}
                    onClick={() => setKeywordCase(opt.value)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                      keywordCase === opt.value
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                icon={<Paintbrush className="w-4 h-4" />}
                onClick={handleFormat}
              >
                {t('app.format.json.format')}
              </Button>
              <Button
                icon={<Copy className="w-4 h-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('public.copy')}
              </Button>
              <Button icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        {error && (
          <CardContent>
            <span className="text-[var(--error)] text-sm">
              {t('app.format.json.error')}: {error}
            </span>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle>{t('app.format.sql.input')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('app.format.sql.input_placeholder')}
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle>{t('app.format.sql.output')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={output}
              readOnly
              placeholder={t('app.format.sql.output_placeholder')}
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SqlClient
