'use client'

import * as Diff from 'diff'
import { ArrowLeftRight, Copy, FileDiff, FlaskConical, Trash2 } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

type DiffMode = 'chars' | 'words' | 'lines' | 'sentences'

const MAX_DIFF_CHARS = 20000
const MAX_DIFF_PREVIEW_CHARS = 10000

const SAMPLE_OLD = `function greet(name) {
  return 'Hello, ' + name
}

console.log(greet('Daily Tools'))`

const SAMPLE_NEW = `function greet(name = 'friend') {
  return \`Hello, ${'${name}'}!\`
}

console.info(greet('Daily Tools'))`

const normalizeText = ({
  ignoreCase,
  ignoreWhitespace,
  text
}: {
  ignoreCase: boolean
  ignoreWhitespace: boolean
  text: string
}) => {
  let nextText = text
  if (ignoreWhitespace) nextText = nextText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  if (ignoreCase) nextText = nextText.toLowerCase()
  return nextText
}

const countLines = (value: string) => (value ? value.split(/\r\n|\r|\n/).length : 0)

const createDiff = (mode: DiffMode, oldValue: string, newValue: string): DiffPart[] => {
  if (mode === 'words') return Diff.diffWordsWithSpace(oldValue, newValue) as DiffPart[]
  if (mode === 'lines') return Diff.diffLines(oldValue, newValue) as DiffPart[]
  if (mode === 'sentences') return Diff.diffSentences(oldValue, newValue) as DiffPart[]
  return Diff.diffChars(oldValue, newValue) as DiffPart[]
}

const buildUnifiedPatch = (oldValue: string, newValue: string) =>
  Diff.createTwoFilesPatch('original.txt', 'modified.txt', oldValue, newValue, '', '', {
    context: 3
  })

const DiffClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')
  const [mode, setMode] = useState<DiffMode>('chars')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const deferredOldText = useDeferredValue(oldText)
  const deferredNewText = useDeferredValue(newText)
  const deferredMode = useDeferredValue(mode)
  const deferredIgnoreCase = useDeferredValue(ignoreCase)
  const deferredIgnoreWhitespace = useDeferredValue(ignoreWhitespace)

  const normalizedOldText = useMemo(
    () =>
      normalizeText({
        ignoreCase: deferredIgnoreCase,
        ignoreWhitespace: deferredIgnoreWhitespace,
        text: deferredOldText
      }),
    [deferredIgnoreCase, deferredIgnoreWhitespace, deferredOldText]
  )
  const normalizedNewText = useMemo(
    () =>
      normalizeText({
        ignoreCase: deferredIgnoreCase,
        ignoreWhitespace: deferredIgnoreWhitespace,
        text: deferredNewText
      }),
    [deferredIgnoreCase, deferredIgnoreWhitespace, deferredNewText]
  )

  const { diffResult, warning } = useMemo(() => {
    if (!deferredOldText && !deferredNewText) {
      return { diffResult: [] as DiffPart[], warning: null as string | null }
    }

    const totalChars = normalizedOldText.length + normalizedNewText.length
    if (totalChars > MAX_DIFF_CHARS) {
      return {
        diffResult: createDiff(
          deferredMode,
          normalizedOldText.slice(0, MAX_DIFF_PREVIEW_CHARS),
          normalizedNewText.slice(0, MAX_DIFF_PREVIEW_CHARS)
        ),
        warning: t('app.format.diff.warning.preview', {
          count: MAX_DIFF_PREVIEW_CHARS
        })
      }
    }

    return {
      diffResult: createDiff(deferredMode, normalizedOldText, normalizedNewText),
      warning: null
    }
  }, [deferredMode, deferredNewText, deferredOldText, normalizedNewText, normalizedOldText, t])

  const patch = useMemo(
    () => buildUnifiedPatch(normalizedOldText, normalizedNewText),
    [normalizedNewText, normalizedOldText]
  )

  const handleSwap = useCallback(() => {
    setOldText(newText)
    setNewText(oldText)
  }, [oldText, newText])

  const handleClear = useCallback(() => {
    setOldText('')
    setNewText('')
  }, [])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    let addedParts = 0
    let removedParts = 0

    diffResult.forEach(part => {
      if (part.added) {
        added += part.value.length
        addedParts += 1
      } else if (part.removed) {
        removed += part.value.length
        removedParts += 1
      }
    })
    return {
      added,
      changedParts: addedParts + removedParts,
      newLines: countLines(normalizedNewText),
      oldLines: countLines(normalizedOldText),
      removed
    }
  }, [diffResult, normalizedNewText, normalizedOldText])

  const loadSample = useCallback(() => {
    setOldText(SAMPLE_OLD)
    setNewText(SAMPLE_NEW)
    setMode('lines')
    setIgnoreCase(false)
    setIgnoreWhitespace(false)
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileDiff className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.diff')}
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={loadSample}
              >
                {t('app.format.diff.sample')}
              </Button>
              <Button icon={<ArrowLeftRight className="h-4 w-4" />} onClick={handleSwap}>
                {t('app.format.diff.swap')}
              </Button>
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
                {t('app.format.json.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DiffStat
              label={t('app.format.diff.stats.added')}
              value={`+${stats.added}`}
              tone="success"
            />
            <DiffStat
              label={t('app.format.diff.stats.removed')}
              value={`-${stats.removed}`}
              tone="error"
            />
            <DiffStat label={t('app.format.diff.stats.chunks')} value={stats.changedParts} />
            <DiffStat
              label={t('app.format.diff.stats.lines')}
              value={`${stats.oldLines} → ${stats.newLines}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <Label htmlFor="diff-mode">{t('app.format.diff.mode')}</Label>
              <Select
                id="diff-mode"
                value={mode}
                onChange={event => setMode(event.target.value as DiffMode)}
              >
                {(['chars', 'words', 'lines', 'sentences'] as const).map(value => (
                  <option key={value} value={value}>
                    {t(`app.format.diff.mode.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={ignoreWhitespace}
                onChange={event => setIgnoreWhitespace(event.target.checked)}
                label={t('app.format.diff.ignore_whitespace')}
              />
              <Checkbox
                checked={ignoreCase}
                onChange={event => setIgnoreCase(event.target.checked)}
                label={t('app.format.diff.ignore_case')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {t('app.format.diff.original')}
              </span>
              <Textarea
                value={oldText}
                onChange={e => setOldText(e.target.value)}
                placeholder={t('app.format.diff.original_placeholder')}
                rows={8}
                className="font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                {t('app.format.diff.text_stats', {
                  chars: oldText.length,
                  lines: countLines(oldText)
                })}
              </p>
            </div>
            <div className="space-y-3">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {t('app.format.diff.modified')}
              </span>
              <Textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder={t('app.format.diff.modified_placeholder')}
                rows={8}
                className="font-mono"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                {t('app.format.diff.text_stats', {
                  chars: newText.length,
                  lines: countLines(newText)
                })}
              </p>
            </div>
          </div>
          {warning && (
            <p className="mt-4 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.format.diff.result')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(patch)}
              >
                {t('app.format.diff.copy_patch')}
              </Button>
              <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(newText)}>
                {t('app.format.diff.copy_modified')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="font-mono text-sm whitespace-pre-wrap break-all leading-relaxed">
            {diffResult.map((part, index) => {
              let className = ''
              if (part.added) {
                className = 'bg-[var(--success-subtle)] text-[var(--success)]'
              } else if (part.removed) {
                className = 'bg-[var(--error-subtle)] text-[var(--error)] line-through'
              }
              return (
                <span key={index} className={className}>
                  {part.value}
                </span>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.format.diff.patch')}</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              icon={<Copy className="h-4 w-4" />}
              onClick={() => copy(patch)}
            >
              {t('public.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={patch} readOnly rows={10} className="resize-none font-mono" />
        </CardContent>
      </Card>
    </div>
  )
}

const DiffStat = ({
  label,
  tone,
  value
}: {
  label: string
  tone?: 'error' | 'success'
  value: number | string
}) => {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'error'
        ? 'text-[var(--error)]'
        : 'text-[var(--text-primary)]'

  return (
    <div className="glass-input rounded-xl p-3">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}

export default DiffClient
