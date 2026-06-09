'use client'

import {
  Columns2,
  Copy,
  Download,
  Eraser,
  Eye,
  FileText,
  Heading2,
  ListTree,
  Paintbrush,
  PanelLeft
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type MarkdownView = 'split' | 'editor' | 'preview'
type MarkdownExport = 'markdown' | 'plain' | 'html' | 'json'

interface MarkdownHeading {
  id: string
  level: number
  line: number
  text: string
}

interface MarkdownStats {
  characters: number
  codeBlocks: number
  headings: MarkdownHeading[]
  links: number
  lines: number
  listItems: number
  minutes: number
  plainText: string
  tables: number
  words: number
}

const MAX_MARKDOWN_PREVIEW_CHARS = 200000
const MAX_MARKDOWN_ANALYSIS_CHARS = 120000
const markdownPreviewNumberFormatter = new Intl.NumberFormat()
const MARKDOWN_EXPORTS: MarkdownExport[] = ['markdown', 'plain', 'html', 'json']
const VIEW_OPTIONS: MarkdownView[] = ['split', 'editor', 'preview']

const MarkdownRenderer = dynamic(() => import('./MarkdownRenderer'), {
  ssr: false,
  loading: () => <div className="h-28 rounded-lg bg-[var(--glass-input-bg)]" aria-hidden="true" />
})

const MARKDOWN_SAMPLES = {
  api: `# API Release Notes

## Summary

The authentication API now supports rotating client secrets and scoped webhook tokens.

## Changes

- Added \`POST /tokens/rotate\`
- Added webhook retry headers
- Deprecated legacy SHA-1 signatures

## Rollout

| Phase | Date | Owner |
| --- | --- | --- |
| Beta | 2026-06-15 | Platform |
| GA | 2026-07-01 | Developer Experience |
`,
  checklist: `# Launch Checklist

- [x] Confirm production environment variables
- [x] Review Open Graph metadata
- [ ] Smoke test mobile navigation
- [ ] Capture release screenshots

## Notes

Keep the release notes short, specific, and linked to the final deployment.
`,
  doc: `# Product Brief

## Problem

Teams need a fast way to turn rough implementation notes into a readable internal brief.

## Proposal

Create a focused Markdown workspace with live preview, copy-ready exports, and lightweight document health metrics.

## Success Criteria

1. Drafts stay readable on mobile.
2. Preview remains responsive for long files.
3. Exports are easy to reuse in docs, issues, and release notes.
`
} as const

const stripMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-z]*\n?/gi, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const slugifyHeading = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const analyzeMarkdown = (value: string, wordsPerMinute: number): MarkdownStats => {
  const plainText = stripMarkdown(value)
  const words = plainText.match(/[\p{L}\p{N}'-]+/gu)?.length ?? 0
  const headings: MarkdownHeading[] = []

  value.split('\n').forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (!match) return
    const text = match[2].replace(/#+$/g, '').trim()
    headings.push({
      id: slugifyHeading(text) || `heading-${index + 1}`,
      level: match[1].length,
      line: index + 1,
      text
    })
  })

  return {
    characters: value.length,
    codeBlocks: value.match(/```/g)?.length
      ? Math.floor((value.match(/```/g)?.length ?? 0) / 2)
      : 0,
    headings,
    links: value.match(/!?\[[^\]]+\]\([^)]+\)/g)?.length ?? 0,
    lines: value ? value.split('\n').length : 0,
    listItems: value.match(/^\s*(?:[-*+]|\d+\.)\s+/gm)?.length ?? 0,
    minutes: words > 0 ? Math.max(1, Math.ceil(words / wordsPerMinute)) : 0,
    plainText,
    tables: value.match(/^\s*\|.+\|\s*$/gm)?.length ? 1 : 0,
    words
  }
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

const MarkdownClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const previewRef = useRef<HTMLDivElement>(null)
  const defaultMarkdown = t('app.preview.markdown.sample')
  const [input, setInput] = useState(defaultMarkdown)
  const [view, setView] = useState<MarkdownView>('split')
  const [exportType, setExportType] = useState<MarkdownExport>('markdown')
  const [wordsPerMinute, setWordsPerMinute] = useState(220)
  const deferredInput = useDeferredValue(input)
  const isPreviewTruncated = deferredInput.length > MAX_MARKDOWN_PREVIEW_CHARS
  const isAnalysisTruncated = deferredInput.length > MAX_MARKDOWN_ANALYSIS_CHARS
  const previewContent = isPreviewTruncated
    ? deferredInput.slice(0, MAX_MARKDOWN_PREVIEW_CHARS)
    : deferredInput
  const analysisContent = isAnalysisTruncated
    ? deferredInput.slice(0, MAX_MARKDOWN_ANALYSIS_CHARS)
    : deferredInput
  const stats = useMemo(
    () => analyzeMarkdown(analysisContent, wordsPerMinute),
    [analysisContent, wordsPerMinute]
  )
  const renderedHtml = () => previewRef.current?.innerHTML.trim() ?? ''
  const exportContent = useMemo(() => {
    if (exportType === 'markdown') return input
    if (exportType === 'plain') return stats.plainText
    if (exportType === 'json') {
      return JSON.stringify(
        {
          stats: {
            characters: stats.characters,
            codeBlocks: stats.codeBlocks,
            headings: stats.headings.length,
            links: stats.links,
            lines: stats.lines,
            listItems: stats.listItems,
            readingMinutes: stats.minutes,
            tables: stats.tables,
            words: stats.words
          },
          toc: stats.headings.map(heading => ({
            id: heading.id,
            level: heading.level,
            line: heading.line,
            text: heading.text
          }))
        },
        null,
        2
      )
    }
    return ''
  }, [exportType, input, stats])

  useEffect(() => {
    setInput(defaultMarkdown)
  }, [defaultMarkdown])

  const handleCopyExport = () => {
    const content = exportType === 'html' ? renderedHtml() : exportContent
    void copy(content)
  }

  const handleDownload = () => {
    const content = exportType === 'html' ? renderedHtml() : exportContent
    const meta = {
      html: { filename: 'markdown-preview.html', type: 'text/html;charset=utf-8' },
      json: { filename: 'markdown-summary.json', type: 'application/json;charset=utf-8' },
      markdown: { filename: 'markdown-draft.md', type: 'text/markdown;charset=utf-8' },
      plain: { filename: 'markdown-text.txt', type: 'text/plain;charset=utf-8' }
    }[exportType]
    downloadText(content, meta.filename, meta.type)
  }

  const applySample = (key: keyof typeof MARKDOWN_SAMPLES) => {
    setInput(MARKDOWN_SAMPLES[key])
    setView('split')
  }

  const editorVisible = view === 'split' || view === 'editor'
  const previewVisible = view === 'split' || view === 'preview'

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--primary)]" />
                {t('app.preview.markdown')}
              </CardTitle>
              <CardDescription>{t('app.preview.markdown.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Paintbrush className="h-3.5 w-3.5" />}
                onClick={() => setInput(defaultMarkdown)}
              >
                {t('app.preview.markdown.sample.default')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Eraser className="h-3.5 w-3.5" />}
                onClick={() => setInput('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {Object.keys(MARKDOWN_SAMPLES).map(key => (
              <Button
                key={key}
                size="sm"
                variant="default"
                icon={<Paintbrush className="h-3.5 w-3.5" />}
                onClick={() => applySample(key as keyof typeof MARKDOWN_SAMPLES)}
              >
                {t(`app.preview.markdown.sample.${key}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Metric label={t('app.preview.markdown.metric.words')} value={stats.words} />
            <Metric label={t('app.preview.markdown.metric.characters')} value={stats.characters} />
            <Metric label={t('app.preview.markdown.metric.lines')} value={stats.lines} />
            <Metric label={t('app.preview.markdown.metric.minutes')} value={stats.minutes} />
            <Metric
              label={t('app.preview.markdown.metric.headings')}
              value={stats.headings.length}
            />
            <Metric label={t('app.preview.markdown.metric.links')} value={stats.links} />
            <Metric label={t('app.preview.markdown.metric.lists')} value={stats.listItems} />
            <Metric label={t('app.preview.markdown.metric.code')} value={stats.codeBlocks} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)_minmax(220px,0.6fr)]">
            <div className="space-y-3">
              <Label>{t('app.preview.markdown.view')}</Label>
              <div className="flex flex-wrap gap-2">
                {VIEW_OPTIONS.map(option => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={view === option ? 'primary' : 'default'}
                    icon={getViewIcon(option)}
                    onClick={() => setView(option)}
                  >
                    {t(`app.preview.markdown.view.${option}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="markdown-export">{t('app.preview.markdown.export')}</Label>
              <Select
                id="markdown-export"
                value={exportType}
                onChange={event => setExportType(event.target.value as MarkdownExport)}
              >
                {MARKDOWN_EXPORTS.map(option => (
                  <option key={option} value={option}>
                    {t(`app.preview.markdown.export.${option}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('app.preview.markdown.reading_speed')}</Label>
                <span className="font-mono text-sm text-[var(--text-secondary)]">
                  {wordsPerMinute} WPM
                </span>
              </div>
              <Slider
                value={wordsPerMinute}
                min={120}
                max={420}
                step={10}
                onChange={setWordsPerMinute}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={handleCopyExport}
              disabled={!input && exportType !== 'json'}
            >
              {t('app.preview.markdown.copy_export')}
            </Button>
            <Button
              size="sm"
              variant="default"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleDownload}
              disabled={!input && exportType !== 'json'}
            >
              {t('app.preview.markdown.download')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(isPreviewTruncated || isAnalysisTruncated) && (
        <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
          {t('app.preview.markdown.warning.truncated', {
            limit: markdownPreviewNumberFormatter.format(
              isPreviewTruncated ? MAX_MARKDOWN_PREVIEW_CHARS : MAX_MARKDOWN_ANALYSIS_CHARS
            )
          })}
        </p>
      )}

      <div
        className={
          view === 'split'
            ? 'grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]'
            : 'grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]'
        }
      >
        {editorVisible && (
          <Card className="flex min-h-[460px] flex-col">
            <CardHeader>
              <CardTitle className="text-base">{t('app.preview.markdown.editor')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                className="h-full resize-none font-mono text-sm"
                placeholder={t('app.preview.markdown.placeholder')}
              />
            </CardContent>
          </Card>
        )}

        {previewVisible && (
          <Card className="flex min-h-[460px] flex-col">
            <CardHeader>
              <CardTitle className="text-base">{t('app.preview.markdown.preview')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div
                ref={previewRef}
                className="markdown-preview text-sm leading-relaxed text-[var(--text-primary)] [content-visibility:auto] [&_a]:text-[var(--primary)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--primary)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--text-secondary)] [&_code]:rounded [&_code]:bg-[var(--bg-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_em]:italic [&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-[var(--border-base)] [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--bg-muted)] [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--border-base)] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[var(--border-base)] [&_th]:bg-[var(--bg-muted)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
              >
                <MarkdownRenderer content={previewContent} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="flex min-h-[460px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-[var(--primary)]" />
              {t('app.preview.markdown.toc')}
            </CardTitle>
            <CardDescription>
              {t('app.preview.markdown.toc_count', { count: stats.headings.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {stats.headings.length > 0 ? (
              <div className="space-y-2">
                {stats.headings.map(heading => (
                  <button
                    key={`${heading.line}-${heading.id}`}
                    type="button"
                    className="glass-input block w-full rounded-xl p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]"
                    style={{ paddingLeft: `${12 + (heading.level - 1) * 12}px` }}
                    onClick={() => copy(`#${heading.id}`)}
                  >
                    <span className="flex items-center gap-2">
                      <Heading2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                      <span className="min-w-0 flex-1 truncate">{heading.text}</span>
                      <span className="font-mono text-xs text-[var(--text-tertiary)]">
                        L{heading.line}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-base)] p-5 text-sm text-[var(--text-secondary)]">
                {t('app.preview.markdown.no_headings')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const getViewIcon = (view: MarkdownView) => {
  if (view === 'split') return <Columns2 className="h-3.5 w-3.5" />
  if (view === 'editor') return <PanelLeft className="h-3.5 w-3.5" />
  return <Eye className="h-3.5 w-3.5" />
}

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
      {markdownPreviewNumberFormatter.format(value)}
    </div>
  </div>
)

export default MarkdownClient
