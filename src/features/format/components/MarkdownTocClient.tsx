'use client'

import {
  Copy,
  Download,
  FileText,
  ListChecks,
  ListTree,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

interface Heading {
  anchor: string
  level: number
  line: number
  text: string
}

type AnchorStyle = 'github' | 'gitlab' | 'ascii'
type TocInsertMode = 'after-title' | 'marker' | 'top'
type MarkdownTocSample = 'docs' | 'api' | 'changelog'

const SAMPLE_MARKDOWN = `# Daily Tools

## Getting started

### Install

### Run locally

## Feature roadmap

### Formatting tools

### Generator tools

## Deployment

### Vercel checklist`

const API_MARKDOWN_SAMPLE = `# API Guide

## Authentication

### Bearer tokens

### Error responses

## Endpoints

### GET /tools

### POST /tools

## Pagination

### Query parameters

### Response envelope`

const CHANGELOG_MARKDOWN_SAMPLE = `# Changelog

## 2.0.0

### Added

### Changed

### Fixed

## 1.9.0

### Added

### Fixed

## 1.8.0

### Added`

const MARKDOWN_TOC_SAMPLES: Record<MarkdownTocSample, string> = {
  api: API_MARKDOWN_SAMPLE,
  changelog: CHANGELOG_MARKDOWN_SAMPLE,
  docs: SAMPLE_MARKDOWN
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const
const MAX_MARKDOWN_TOC_CHARS = 200000
const MAX_MARKDOWN_TOC_LIVE_DOCUMENT_CHARS = 60000
const MAX_MARKDOWN_TOC_OUTPUT_ROWS = 500
const MAX_MARKDOWN_TOC_OUTLINE_ROWS = 160
const MAX_MARKDOWN_TOC_TITLE_CHARS = 120
const tocNumberFormatter = new Intl.NumberFormat()

const normalizeAnchorText = (value: string, style: AnchorStyle) => {
  const lowered = value.toLowerCase().trim()
  const ascii =
    style === 'ascii' ? lowered.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : lowered
  const stripped =
    style === 'gitlab'
      ? ascii.replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      : ascii.replace(/[`~!@#$%^&*()+=[\]{}|;:'",.<>/?\\]/g, '')

  return stripped.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section'
}

const slugifyHeading = (value: string, used: Map<string, number>, style: AnchorStyle) => {
  const base = normalizeAnchorText(value, style)

  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

const extractHeadings = (markdown: string, anchorStyle: AnchorStyle) => {
  const headings: Heading[] = []
  const used = new Map<string, number>()
  let inFence = false

  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      inFence = !inFence
      return
    }

    if (inFence) return

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return

    const text = match[2].trim()
    headings.push({
      anchor: slugifyHeading(text, used, anchorStyle),
      level: match[1].length,
      line: index + 1,
      text
    })
  })

  return headings
}

const buildToc = ({
  headings,
  maxLevel,
  minLevel,
  ordered,
  taskList
}: {
  headings: Heading[]
  maxLevel: number
  minLevel: number
  ordered: boolean
  taskList: boolean
}) => {
  const visible: Heading[] = []
  let baseLevel = Number.POSITIVE_INFINITY

  headings.forEach(heading => {
    if (heading.level < minLevel || heading.level > maxLevel) return
    visible.push(heading)
    if (heading.level < baseLevel) baseLevel = heading.level
  })

  if (!visible.length) return ''

  return visible
    .map((heading, index) => {
      const indent = '  '.repeat(Math.max(0, heading.level - baseLevel))
      const marker = ordered ? `${index + 1}.` : taskList ? '- [ ]' : '-'
      return `${indent}${marker} [${heading.text}](#${heading.anchor})`
    })
    .join('\n')
}

const insertToc = (markdown: string, toc: string, mode: TocInsertMode, title: string) => {
  if (!toc) return markdown
  const block = `${title}\n\n${toc}\n`
  const marker = '<!-- toc -->'

  if (markdown.includes(marker)) {
    return markdown.replace(marker, `${marker}\n\n${block}`)
  }

  if (mode === 'marker') return `${marker}\n\n${block}\n\n${markdown}`
  if (mode === 'top') return `${block}\n\n${markdown}`

  const lines = markdown.split(/\r?\n/)
  const firstHeadingIndex = lines.findIndex(line => /^#\s+/.test(line))
  if (firstHeadingIndex < 0) return `${block}\n${markdown}`

  const before = lines.slice(0, firstHeadingIndex + 1).join('\n')
  const after = lines
    .slice(firstHeadingIndex + 1)
    .join('\n')
    .trimStart()
  return `${before}\n\n${block}\n${after}`
}

const countWords = (markdown: string) => {
  let count = 0

  for (const match of markdown.matchAll(/\S+/g)) {
    count += 1
    if (!match[0]) break
  }

  return count
}

const formatTocNumber = (value: number) => tocNumberFormatter.format(value)

const getDuplicateHeadingCount = (headings: Heading[]) => {
  const counts = new Map<string, number>()
  headings.forEach(heading => {
    const key = heading.text.trim().toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.values()].filter(count => count > 1).length
}

const getLevelCounts = (headings: Heading[]) =>
  HEADING_LEVELS.map(level => ({
    count: headings.filter(heading => heading.level === level).length,
    level
  }))

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const MarkdownTocClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [isMarkdownCapped, setIsMarkdownCapped] = useState(false)
  const [minLevel, setMinLevel] = useState(2)
  const [maxLevel, setMaxLevel] = useState(4)
  const [ordered, setOrdered] = useState(false)
  const [taskList, setTaskList] = useState(false)
  const [includeLineNumbers, setIncludeLineNumbers] = useState(false)
  const [anchorStyle, setAnchorStyle] = useState<AnchorStyle>('github')
  const [insertMode, setInsertMode] = useState<TocInsertMode>('after-title')
  const [tocTitle, setTocTitle] = useState('## Table of contents')
  const deferredMarkdown = useDeferredValue(markdown)

  const updateMarkdown = (value: string) => {
    const capped = value.length > MAX_MARKDOWN_TOC_CHARS
    setIsMarkdownCapped(capped)
    setMarkdown(capped ? value.slice(0, MAX_MARKDOWN_TOC_CHARS) : value)
  }

  const tocSource = useMemo(
    () =>
      deferredMarkdown.length > MAX_MARKDOWN_TOC_CHARS
        ? deferredMarkdown.slice(0, MAX_MARKDOWN_TOC_CHARS)
        : deferredMarkdown,
    [deferredMarkdown]
  )
  const isTocSourceTruncated = isMarkdownCapped || deferredMarkdown.length > MAX_MARKDOWN_TOC_CHARS
  const headings = useMemo(() => extractHeadings(tocSource, anchorStyle), [anchorStyle, tocSource])
  const filteredHeadings = useMemo(
    () => headings.filter(heading => heading.level >= minLevel && heading.level <= maxLevel),
    [headings, maxLevel, minLevel]
  )
  const tocHeadings = useMemo(
    () => filteredHeadings.slice(0, MAX_MARKDOWN_TOC_OUTPUT_ROWS),
    [filteredHeadings]
  )
  const visibleHeadings = useMemo(
    () => filteredHeadings.slice(0, MAX_MARKDOWN_TOC_OUTLINE_ROWS),
    [filteredHeadings]
  )
  const toc = useMemo(
    () => buildToc({ headings: tocHeadings, maxLevel, minLevel, ordered, taskList }),
    [maxLevel, minLevel, ordered, taskList, tocHeadings]
  )
  const liveDocumentDeferred = tocSource.length > MAX_MARKDOWN_TOC_LIVE_DOCUMENT_CHARS
  const documentPreviewSource = useMemo(
    () =>
      insertToc(
        liveDocumentDeferred ? tocSource.slice(0, MAX_MARKDOWN_TOC_LIVE_DOCUMENT_CHARS) : tocSource,
        toc,
        insertMode,
        tocTitle.trim() || '## Table of contents'
      ),
    [insertMode, liveDocumentDeferred, toc, tocSource, tocTitle]
  )
  const tocPreview = useMemo(() => createOutputPreview(toc), [toc])
  const tocPreviewLimited = isOutputPreviewLimited(toc)
  const markdownWithTocPreview = useMemo(
    () => createOutputPreview(documentPreviewSource),
    [documentPreviewSource]
  )
  const markdownWithTocPreviewLimited = isOutputPreviewLimited(documentPreviewSource)
  const isTocOutputLimited = filteredHeadings.length > tocHeadings.length
  const isOutlineLimited = filteredHeadings.length > visibleHeadings.length
  const levelCounts = useMemo(() => getLevelCounts(headings), [headings])
  const tocMetrics = useMemo(
    () => ({
      duplicates: getDuplicateHeadingCount(headings),
      deepest: headings.reduce((deepest, heading) => Math.max(deepest, heading.level), 0),
      outputLines: toc ? toc.split(/\r?\n/).length : 0,
      words: tocSource.trim() ? countWords(tocSource) : 0
    }),
    [headings, toc, tocSource]
  )

  const reset = () => {
    updateMarkdown(SAMPLE_MARKDOWN)
    setMinLevel(2)
    setMaxLevel(4)
    setOrdered(false)
    setTaskList(false)
    setIncludeLineNumbers(false)
    setAnchorStyle('github')
    setInsertMode('after-title')
    setTocTitle('## Table of contents')
  }

  const handleSample = (sample: MarkdownTocSample) => {
    updateMarkdown(MARKDOWN_TOC_SAMPLES[sample])
    setMinLevel(sample === 'changelog' ? 2 : 2)
    setMaxLevel(sample === 'api' ? 3 : 4)
  }

  const handleDownload = (content: string, filename: string) => {
    if (!content) return
    downloadText(content, filename, 'text/markdown;charset=utf-8')
  }

  const buildCurrentDocument = () =>
    insertToc(tocSource, toc, insertMode, tocTitle.trim() || '## Table of contents')

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <ListTree className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.markdown_toc')}
              </CardTitle>
              <CardDescription>{t('app.format.markdown_toc.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                disabled={!toc}
                onClick={() => copy(toc)}
              >
                {t('app.format.markdown_toc.copy_toc')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                disabled={!toc}
                onClick={() => handleDownload(toc, 'markdown-toc.md')}
              >
                {t('app.format.markdown_toc.download_toc')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['docs', 'api', 'changelog'] as const).map(sample => (
              <Button
                key={sample}
                type="button"
                size="sm"
                variant="outline"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleSample(sample)}
              >
                {t(`app.format.markdown_toc.sample.${sample}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="toc-input">{t('app.format.markdown_toc.input')}</Label>
              <Textarea
                id="toc-input"
                value={markdown}
                onChange={event => updateMarkdown(event.target.value)}
                rows={14}
                className="min-h-[320px] resize-y font-mono"
                placeholder="# Title"
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <Label htmlFor="toc-min">{t('app.format.markdown_toc.min_level')}</Label>
                  <Select
                    id="toc-min"
                    value={String(minLevel)}
                    onChange={event => setMinLevel(Number(event.target.value))}
                  >
                    {HEADING_LEVELS.map(level => (
                      <option key={level} value={level}>
                        H{level}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="toc-max">{t('app.format.markdown_toc.max_level')}</Label>
                  <Select
                    id="toc-max"
                    value={String(maxLevel)}
                    onChange={event => setMaxLevel(Number(event.target.value))}
                  >
                    {HEADING_LEVELS.map(level => (
                      <option key={level} value={level}>
                        H{level}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-3">
                  <Label htmlFor="toc-anchor-style">
                    {t('app.format.markdown_toc.anchor_style')}
                  </Label>
                  <Select
                    id="toc-anchor-style"
                    value={anchorStyle}
                    onChange={event => setAnchorStyle(event.target.value as AnchorStyle)}
                  >
                    <option value="github">
                      {t('app.format.markdown_toc.anchor_style.github')}
                    </option>
                    <option value="gitlab">
                      {t('app.format.markdown_toc.anchor_style.gitlab')}
                    </option>
                    <option value="ascii">{t('app.format.markdown_toc.anchor_style.ascii')}</option>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="toc-insert-mode">
                    {t('app.format.markdown_toc.insert_mode')}
                  </Label>
                  <Select
                    id="toc-insert-mode"
                    value={insertMode}
                    onChange={event => setInsertMode(event.target.value as TocInsertMode)}
                  >
                    <option value="after-title">
                      {t('app.format.markdown_toc.insert.after_title')}
                    </option>
                    <option value="marker">{t('app.format.markdown_toc.insert.marker')}</option>
                    <option value="top">{t('app.format.markdown_toc.insert.top')}</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="toc-title">{t('app.format.markdown_toc.title')}</Label>
                <Input
                  id="toc-title"
                  value={tocTitle}
                  onChange={event =>
                    setTocTitle(event.target.value.slice(0, MAX_MARKDOWN_TOC_TITLE_CHARS))
                  }
                  maxLength={MAX_MARKDOWN_TOC_TITLE_CHARS}
                  className="font-mono"
                />
              </div>

              <div className="glass-input rounded-xl p-3">
                <Checkbox
                  checked={ordered}
                  onChange={event => setOrdered(event.target.checked)}
                  label={t('app.format.markdown_toc.ordered')}
                />
                <Checkbox
                  checked={taskList}
                  onChange={event => setTaskList(event.target.checked)}
                  label={t('app.format.markdown_toc.task_list')}
                />
                <Checkbox
                  checked={includeLineNumbers}
                  onChange={event => setIncludeLineNumbers(event.target.checked)}
                  label={t('app.format.markdown_toc.line_numbers')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TocMetric label={t('app.format.markdown_toc.headings')} value={headings.length} />
                <TocMetric
                  label={t('app.format.markdown_toc.visible')}
                  value={filteredHeadings.length}
                />
                <TocMetric
                  label={t('app.format.markdown_toc.deepest')}
                  value={tocMetrics.deepest}
                />
                <TocMetric label={t('app.format.markdown_toc.words')} value={tocMetrics.words} />
                <TocMetric
                  label={t('app.format.markdown_toc.duplicates')}
                  value={tocMetrics.duplicates}
                />
                <TocMetric
                  label={t('app.format.markdown_toc.output_lines')}
                  value={tocMetrics.outputLines}
                />
              </div>

              <Button
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => updateMarkdown('')}
                className="w-full"
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>

          {isTocSourceTruncated && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.markdown_toc.warning.truncated', {
                limit: formatTocNumber(MAX_MARKDOWN_TOC_CHARS)
              })}
            </p>
          )}
          {isTocOutputLimited && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.markdown_toc.warning.toc_rows', {
                total: formatTocNumber(filteredHeadings.length),
                visible: formatTocNumber(tocHeadings.length)
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">{t('app.format.markdown_toc.output')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(buildCurrentDocument())}
                  disabled={!toc}
                >
                  {t('app.format.markdown_toc.copy_document')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => handleDownload(buildCurrentDocument(), 'document-with-toc.md')}
                  disabled={!toc}
                >
                  {t('app.format.markdown_toc.download_document')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="toc-output">{t('app.format.markdown_toc.toc')}</Label>
              <Textarea
                id="toc-output"
                value={tocPreview}
                readOnly
                rows={14}
                className="min-h-[300px] resize-none font-mono"
                placeholder={t('app.format.markdown_toc.empty')}
              />
              {tocPreviewLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_limited', {
                    total: toc.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label htmlFor="toc-document">{t('app.format.markdown_toc.document')}</Label>
              <Textarea
                id="toc-document"
                value={markdownWithTocPreview}
                readOnly
                rows={14}
                className="min-h-[300px] resize-none font-mono"
                placeholder={t('app.format.markdown_toc.empty')}
              />
              {markdownWithTocPreviewLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_limited', {
                    total: documentPreviewSource.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
              {liveDocumentDeferred && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('app.format.markdown_toc.warning.live_document_deferred', {
                    total: formatTocNumber(tocSource.length),
                    visible: formatTocNumber(MAX_MARKDOWN_TOC_LIVE_DOCUMENT_CHARS)
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.markdown_toc.outline')}
            </CardTitle>
            <CardDescription>{t('app.format.markdown_toc.outline_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-2 overflow-auto">
            {visibleHeadings.length ? (
              visibleHeadings.map(heading => (
                <div
                  key={`${heading.line}-${heading.anchor}`}
                  className="glass-input rounded-xl p-3"
                  style={{ marginInlineStart: `${Math.max(0, heading.level - minLevel) * 14}px` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{heading.text}</p>
                    <span className="shrink-0 font-mono text-xs text-[var(--text-tertiary)]">
                      H{heading.level}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    #{heading.anchor}
                    {includeLineNumbers ? ` / line ${heading.line}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] text-sm text-[var(--text-tertiary)]">
                {t('app.format.markdown_toc.empty')}
              </div>
            )}
            {isOutlineLimited && (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t('app.format.markdown_toc.warning.outline_rows', {
                  total: formatTocNumber(filteredHeadings.length),
                  visible: formatTocNumber(visibleHeadings.length)
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.markdown_toc.level_distribution')}
            </CardTitle>
            <CardDescription>
              {t('app.format.markdown_toc.level_distribution_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {levelCounts.map(item => (
                <TocMetric key={item.level} label={`H${item.level}`} value={item.count} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.markdown_toc.diagnostics')}</CardTitle>
            <CardDescription>{t('app.format.markdown_toc.diagnostics_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tocMetrics.duplicates ? (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t('app.format.markdown_toc.duplicate_warning', {
                  count: tocMetrics.duplicates
                })}
              </p>
            ) : (
              <p className="rounded-lg border border-[var(--success)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success)]">
                {t('app.format.markdown_toc.duplicate_clean')}
              </p>
            )}
            {!filteredHeadings.length && (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t('app.format.markdown_toc.no_visible_warning')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const TocMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default MarkdownTocClient
