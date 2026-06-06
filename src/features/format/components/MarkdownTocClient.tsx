'use client'

import { Copy, FileText, ListTree, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface Heading {
  anchor: string
  level: number
  line: number
  text: string
}

const SAMPLE_MARKDOWN = `# Daily Tools

## Getting started

### Install

### Run locally

## Feature roadmap

### Formatting tools

### Generator tools

## Deployment

### Vercel checklist`

const slugifyHeading = (value: string, used: Map<string, number>) => {
  const base =
    value
      .toLowerCase()
      .replace(/[`~!@#$%^&*()+=[\]{}|;:'",.<>/?\\]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'

  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

const extractHeadings = (markdown: string) => {
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
      anchor: slugifyHeading(text, used),
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
  ordered
}: {
  headings: Heading[]
  maxLevel: number
  minLevel: number
  ordered: boolean
}) => {
  const visible = headings.filter(heading => heading.level >= minLevel && heading.level <= maxLevel)
  if (!visible.length) return ''

  const baseLevel = Math.min(...visible.map(heading => heading.level))

  return visible
    .map((heading, index) => {
      const indent = '  '.repeat(Math.max(0, heading.level - baseLevel))
      const marker = ordered ? `${index + 1}.` : '-'
      return `${indent}${marker} [${heading.text}](#${heading.anchor})`
    })
    .join('\n')
}

const insertToc = (markdown: string, toc: string) => {
  if (!toc) return markdown
  const block = `## Table of contents\n\n${toc}\n`
  const marker = '<!-- toc -->'

  if (markdown.includes(marker)) {
    return markdown.replace(marker, `${marker}\n\n${block}`)
  }

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

const MarkdownTocClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [minLevel, setMinLevel] = useState(2)
  const [maxLevel, setMaxLevel] = useState(4)
  const [ordered, setOrdered] = useState(false)
  const [includeLineNumbers, setIncludeLineNumbers] = useState(false)

  const headings = useMemo(() => extractHeadings(markdown), [markdown])
  const toc = useMemo(
    () => buildToc({ headings, maxLevel, minLevel, ordered }),
    [headings, maxLevel, minLevel, ordered]
  )
  const markdownWithToc = useMemo(() => insertToc(markdown, toc), [markdown, toc])
  const filteredHeadings = headings.filter(
    heading => heading.level >= minLevel && heading.level <= maxLevel
  )

  const reset = () => {
    setMarkdown(SAMPLE_MARKDOWN)
    setMinLevel(2)
    setMaxLevel(4)
    setOrdered(false)
    setIncludeLineNumbers(false)
  }

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
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="toc-input">{t('app.format.markdown_toc.input')}</Label>
              <Textarea
                id="toc-input"
                value={markdown}
                onChange={event => setMarkdown(event.target.value)}
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
                    {[1, 2, 3, 4, 5, 6].map(level => (
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
                    {[1, 2, 3, 4, 5, 6].map(level => (
                      <option key={level} value={level}>
                        H{level}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="glass-input rounded-xl p-3">
                <Checkbox
                  checked={ordered}
                  onChange={event => setOrdered(event.target.checked)}
                  label={t('app.format.markdown_toc.ordered')}
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
                  value={headings.length ? Math.max(...headings.map(heading => heading.level)) : 0}
                />
                <TocMetric
                  label={t('app.format.markdown_toc.words')}
                  value={markdown.trim() ? markdown.trim().split(/\s+/).length : 0}
                />
              </div>

              <Button
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setMarkdown('')}
                className="w-full"
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.format.markdown_toc.output')}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(markdownWithToc)}
                disabled={!toc}
              >
                {t('app.format.markdown_toc.copy_document')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="toc-output">{t('app.format.markdown_toc.toc')}</Label>
              <Textarea
                id="toc-output"
                value={toc}
                readOnly
                rows={14}
                className="min-h-[300px] resize-none font-mono"
                placeholder={t('app.format.markdown_toc.empty')}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="toc-document">{t('app.format.markdown_toc.document')}</Label>
              <Textarea
                id="toc-document"
                value={markdownWithToc}
                readOnly
                rows={14}
                className="min-h-[300px] resize-none font-mono"
                placeholder={t('app.format.markdown_toc.empty')}
              />
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
            {filteredHeadings.length ? (
              filteredHeadings.map(heading => (
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
