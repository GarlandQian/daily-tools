'use client'

import { ArrowLeftRight, Copy, FileDiff, FlaskConical, Trash2 } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

interface DiffState {
  diffResult: DiffPart[]
  error: string | null
  patch: string
  requestKey: string
}

type DiffMode = 'chars' | 'words' | 'lines' | 'sentences'
type DiffModule = typeof import('diff')

const MAX_DIFF_CHARS = 20000
const MAX_DIFF_PREVIEW_CHARS = 10000
const MAX_DIFF_RENDERED_PARTS = 800
const EMPTY_DIFF_STATE: DiffState = {
  diffResult: [],
  error: null,
  patch: '',
  requestKey: ''
}
let diffModulePromise: Promise<DiffModule> | null = null

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

const countLines = (value: string, maxChars = MAX_DIFF_CHARS) => {
  if (!value) return 0

  const limit = Math.min(value.length, maxChars)
  let lines = 1

  for (let index = 0; index < limit; index += 1) {
    if (value.charCodeAt(index) === 10) lines += 1
  }

  return lines
}

const loadDiffModule = () => {
  diffModulePromise ??= import('diff')
  return diffModulePromise
}

const createDiff = (
  diffModule: DiffModule,
  mode: DiffMode,
  oldValue: string,
  newValue: string
): DiffPart[] => {
  if (mode === 'words') return diffModule.diffWordsWithSpace(oldValue, newValue) as DiffPart[]
  if (mode === 'lines') return diffModule.diffLines(oldValue, newValue) as DiffPart[]
  if (mode === 'sentences') return diffModule.diffSentences(oldValue, newValue) as DiffPart[]
  return diffModule.diffChars(oldValue, newValue) as DiffPart[]
}

const buildUnifiedPatch = (diffModule: DiffModule, oldValue: string, newValue: string) =>
  diffModule.createTwoFilesPatch('original.txt', 'modified.txt', oldValue, newValue, '', '', {
    context: 3
  })

const DiffClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')
  const [isOldTextCapped, setIsOldTextCapped] = useState(false)
  const [isNewTextCapped, setIsNewTextCapped] = useState(false)
  const [mode, setMode] = useState<DiffMode>('chars')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const deferredOldText = useDeferredValue(oldText)
  const deferredNewText = useDeferredValue(newText)
  const deferredMode = useDeferredValue(mode)
  const deferredIgnoreCase = useDeferredValue(ignoreCase)
  const deferredIgnoreWhitespace = useDeferredValue(ignoreWhitespace)

  const safeDiffSource = useMemo(() => {
    const totalChars = deferredOldText.length + deferredNewText.length
    const isPreview = isOldTextCapped || isNewTextCapped || totalChars > MAX_DIFF_CHARS

    return {
      isPreview,
      newText: isPreview ? deferredNewText.slice(0, MAX_DIFF_PREVIEW_CHARS) : deferredNewText,
      oldText: isPreview ? deferredOldText.slice(0, MAX_DIFF_PREVIEW_CHARS) : deferredOldText
    }
  }, [deferredNewText, deferredOldText, isNewTextCapped, isOldTextCapped])
  const normalizedOldText = useMemo(
    () =>
      normalizeText({
        ignoreCase: deferredIgnoreCase,
        ignoreWhitespace: deferredIgnoreWhitespace,
        text: safeDiffSource.oldText
      }),
    [deferredIgnoreCase, deferredIgnoreWhitespace, safeDiffSource.oldText]
  )
  const normalizedNewText = useMemo(
    () =>
      normalizeText({
        ignoreCase: deferredIgnoreCase,
        ignoreWhitespace: deferredIgnoreWhitespace,
        text: safeDiffSource.newText
      }),
    [deferredIgnoreCase, deferredIgnoreWhitespace, safeDiffSource.newText]
  )

  const hasDiffInput = Boolean(deferredOldText || deferredNewText)
  const diffRequestKey = hasDiffInput
    ? [deferredMode, normalizedOldText, normalizedNewText].join('\u0000')
    : ''
  const [diffState, setDiffState] = useState<DiffState>(EMPTY_DIFF_STATE)

  useEffect(() => {
    if (!hasDiffInput) return

    let isCurrent = true

    void loadDiffModule()
      .then(diffModule => {
        if (!isCurrent) return

        setDiffState({
          diffResult: createDiff(diffModule, deferredMode, normalizedOldText, normalizedNewText),
          error: null,
          patch: buildUnifiedPatch(diffModule, normalizedOldText, normalizedNewText),
          requestKey: diffRequestKey
        })
      })
      .catch(error => {
        if (!isCurrent) return

        setDiffState({
          diffResult: [],
          error: error instanceof Error ? error.message : String(error),
          patch: '',
          requestKey: diffRequestKey
        })
      })

    return () => {
      isCurrent = false
    }
  }, [deferredMode, diffRequestKey, hasDiffInput, normalizedNewText, normalizedOldText])

  const isDiffStateCurrent = hasDiffInput && diffState.requestKey === diffRequestKey
  const isDiffLoading = hasDiffInput && !isDiffStateCurrent
  const currentDiffState = isDiffStateCurrent ? diffState : EMPTY_DIFF_STATE
  const diffResult = currentDiffState.diffResult
  const patch = currentDiffState.patch
  const warning =
    hasDiffInput && safeDiffSource.isPreview
      ? t('app.format.diff.warning.preview', {
          count: MAX_DIFF_PREVIEW_CHARS
        })
      : null
  const patchPreview = useMemo(() => createOutputPreview(patch), [patch])
  const patchPreviewLimited = isOutputPreviewLimited(patch)
  const visibleDiffResult = useMemo(
    () => diffResult.slice(0, MAX_DIFF_RENDERED_PARTS),
    [diffResult]
  )
  const isDiffResultLimited = diffResult.length > visibleDiffResult.length

  const updateOldText = useCallback((value: string) => {
    const capped = value.length > MAX_DIFF_CHARS
    setIsOldTextCapped(capped)
    setOldText(capped ? value.slice(0, MAX_DIFF_CHARS) : value)
  }, [])

  const updateNewText = useCallback((value: string) => {
    const capped = value.length > MAX_DIFF_CHARS
    setIsNewTextCapped(capped)
    setNewText(capped ? value.slice(0, MAX_DIFF_CHARS) : value)
  }, [])

  const handleSwap = useCallback(() => {
    setIsOldTextCapped(isNewTextCapped)
    setIsNewTextCapped(isOldTextCapped)
    setOldText(newText)
    setNewText(oldText)
  }, [isNewTextCapped, isOldTextCapped, oldText, newText])

  const handleClear = useCallback(() => {
    setIsOldTextCapped(false)
    setIsNewTextCapped(false)
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
    setIsOldTextCapped(false)
    setIsNewTextCapped(false)
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
                onChange={e => updateOldText(e.target.value)}
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
                onChange={e => updateNewText(e.target.value)}
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
          {isDiffLoading && (
            <p className="mt-4 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {t('public.loading')}
            </p>
          )}
          {currentDiffState.error && (
            <p className="mt-4 rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
              {t('app.format.diff.warning.parser_failed')}
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
                disabled={!patch || isDiffLoading}
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
            {visibleDiffResult.map((part, index) => {
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
          {isDiffResultLimited && (
            <p className="mt-4 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.diff.warning.parts_limited', {
                total: diffResult.length,
                visible: visibleDiffResult.length
              })}
            </p>
          )}
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
              disabled={!patch || isDiffLoading}
            >
              {t('public.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={patchPreview} readOnly rows={10} className="resize-none font-mono" />
          {patchPreviewLimited && (
            <p className="mt-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('public.output_preview_limited', {
                total: patch.length.toLocaleString(),
                visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
              })}
            </p>
          )}
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
