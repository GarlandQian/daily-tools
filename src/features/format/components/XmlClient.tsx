'use client'

import {
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ListTree,
  Minimize2,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Tags,
  Trash2,
  XCircle
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import xmlFormat from 'xml-formatter'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type XmlMode = 'format' | 'minify'
type IndentSize = '2' | '4' | 'tab'

interface XmlStats {
  attributes: number
  cdata: number
  characters: number
  comments: number
  depth: number
  elements: number
  lines: number
  processingInstructions: number
}

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog generated="2026-06-08">
  <book id="bk-101" status="available">
    <title>Daily Tools Handbook</title>
    <author>Garland</author>
    <tags>
      <tag>utility</tag>
      <tag>format</tag>
    </tags>
  </book>
  <book id="bk-102" status="draft">
    <title>Liquid UI Notes</title>
    <author>Design Team</author>
  </book>
</catalog>`

const MAX_XML_INPUT_CHARS = 200000
const MAX_XML_NODE_ROWS = 90
const xmlNumberFormatter = new Intl.NumberFormat()

const formatXmlNumber = (value: number) => xmlNumberFormatter.format(value)
const getIndentation = (indentSize: IndentSize) =>
  indentSize === 'tab' ? '\t' : ' '.repeat(Number(indentSize))

const formatXmlOutput = (
  input: string,
  mode: XmlMode,
  indentSize: IndentSize,
  collapseContent: boolean
) => {
  if (mode === 'minify') return xmlFormat.minify(input, { collapseContent })

  return xmlFormat(input, {
    collapseContent,
    indentation: getIndentation(indentSize),
    lineSeparator: '\n'
  })
}

const parseXmlDocument = (input: string) => {
  if (typeof DOMParser === 'undefined') return { document: null, error: '' }

  const parser = new DOMParser()
  const document = parser.parseFromString(input, 'application/xml')
  const parserError = document.querySelector('parsererror')

  if (parserError) {
    return { document: null, error: parserError.textContent?.trim() || 'Invalid XML' }
  }

  return { document, error: '' }
}

const getElementPath = (element: Element) => {
  const segments: string[] = []
  let current: Element | null = element

  while (current) {
    let index = 1
    let sibling = current.previousElementSibling

    while (sibling) {
      if (sibling.tagName === current.tagName) index += 1
      sibling = sibling.previousElementSibling
    }

    segments.unshift(`${current.tagName}[${index}]`)
    current = current.parentElement
  }

  return `/${segments.join('/')}`
}

const inspectXmlDocument = (document: Document, source: string) => {
  const elements = Array.from(document.getElementsByTagName('*'))
  const stats: XmlStats = {
    attributes: elements.reduce((total, element) => total + element.attributes.length, 0),
    cdata: (source.match(/<!\[CDATA\[/g) || []).length,
    characters: source.length,
    comments: (source.match(/<!--[\s\S]*?-->/g) || []).length,
    depth: 0,
    elements: elements.length,
    lines: source ? source.split(/\r?\n/).length : 0,
    processingInstructions: (source.match(/<\?(?!xml\b)[\s\S]*?\?>/gi) || []).length
  }
  const tagCounts = new Map<string, number>()
  const attributeCounts = new Map<string, number>()

  const nodes = elements.slice(0, MAX_XML_NODE_ROWS).map(element => {
    let depth = 0
    let parent = element.parentElement

    while (parent) {
      depth += 1
      parent = parent.parentElement
    }

    stats.depth = Math.max(stats.depth, depth + 1)
    tagCounts.set(element.tagName, (tagCounts.get(element.tagName) ?? 0) + 1)

    for (const attribute of Array.from(element.attributes)) {
      attributeCounts.set(attribute.name, (attributeCounts.get(attribute.name) ?? 0) + 1)
    }

    return {
      attributes: element.attributes.length,
      depth: depth + 1,
      name: element.tagName,
      path: getElementPath(element)
    }
  })

  return {
    attributes: [...attributeCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24),
    nodes,
    stats,
    tags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
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

const XmlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<XmlMode>('format')
  const [indentSize, setIndentSize] = useState<IndentSize>('2')
  const [collapseContent, setCollapseContent] = useState(true)
  const deferredInput = useDeferredValue(input)
  const isInputTooLarge = deferredInput.length > MAX_XML_INPUT_CHARS
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_XML_INPUT_CHARS
        ? deferredInput.slice(0, MAX_XML_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )

  const formatted = useMemo(() => {
    const trimmed = safeInput.trim()
    if (!trimmed || isInputTooLarge) return { error: '', output: '' }

    try {
      return {
        error: '',
        output: formatXmlOutput(trimmed, mode, indentSize, collapseContent)
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), output: '' }
    }
  }, [collapseContent, indentSize, isInputTooLarge, mode, safeInput])

  const parsed = useMemo(() => {
    if (!safeInput.trim() || isInputTooLarge || formatted.error) {
      return { attributes: [], error: '', nodes: [], stats: null, tags: [] }
    }

    const result = parseXmlDocument(safeInput)
    if (!result.document) {
      return { attributes: [], error: result.error, nodes: [], stats: null, tags: [] }
    }

    return { ...inspectXmlDocument(result.document, safeInput), error: '' }
  }, [formatted.error, isInputTooLarge, safeInput])

  const validationError = formatted.error || parsed.error
  const hasInput = input.trim().length > 0

  const handleValidate = () => {
    if (!hasInput) {
      toast.warning(t('app.format.xml.empty'))
      return
    }

    if (isInputTooLarge) {
      toast.warning(
        t('app.format.xml.warning.too_large', {
          limit: formatXmlNumber(MAX_XML_INPUT_CHARS)
        })
      )
      return
    }

    if (validationError) {
      toast.error(`${t('app.format.xml.invalid')}: ${validationError}`)
    } else {
      toast.success(t('app.format.xml.valid'))
    }
  }

  const handleUseSample = () => {
    setInput(XML_SAMPLE)
    setMode('format')
    setIndentSize('2')
    setCollapseContent(true)
  }

  const handleUseOutput = () => {
    if (formatted.output) setInput(formatted.output)
  }

  const handleClear = () => {
    setInput('')
    setMode('format')
    setIndentSize('2')
    setCollapseContent(true)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.xml')}
            </CardTitle>
            <CardDescription>{t('app.format.xml.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === 'format' ? 'primary' : 'default'}
              icon={<Paintbrush className="h-4 w-4" />}
              onClick={() => setMode('format')}
            >
              {t('app.format.xml.format')}
            </Button>
            <Button
              type="button"
              variant={mode === 'minify' ? 'primary' : 'default'}
              icon={<Minimize2 className="h-4 w-4" />}
              onClick={() => setMode('minify')}
            >
              {t('app.format.xml.minify')}
            </Button>
            <Button
              type="button"
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={handleValidate}
              disabled={!hasInput}
            >
              {t('app.format.xml.validate')}
            </Button>
            <Button
              type="button"
              icon={<Copy className="h-4 w-4" />}
              onClick={() => formatted.output && void copy(formatted.output)}
              disabled={!formatted.output}
            >
              {t('public.copy')}
            </Button>
            <Button
              type="button"
              icon={<Download className="h-4 w-4" />}
              disabled={!formatted.output}
              onClick={() =>
                downloadText(formatted.output, 'daily-tools.xml', 'application/xml;charset=utf-8')
              }
            >
              {t('app.format.xml.download')}
            </Button>
            <Button
              type="button"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleUseOutput}
              disabled={!formatted.output}
            >
              {t('app.format.xml.use_output')}
            </Button>
            <Button type="button" icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
              {t('public.clear')}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="xml-indent">{t('app.format.xml.indent')}</Label>
              <Select
                id="xml-indent"
                value={indentSize}
                disabled={mode === 'minify'}
                onChange={event => setIndentSize(event.target.value as IndentSize)}
              >
                <option value="2">{t('app.format.xml.indent.2')}</option>
                <option value="4">{t('app.format.xml.indent.4')}</option>
                <option value="tab">{t('app.format.xml.indent.tab')}</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Checkbox
                checked={collapseContent}
                onChange={event => setCollapseContent(event.target.checked)}
                label={t('app.format.xml.collapse_content')}
              />
              <Button
                type="button"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={handleUseSample}
              >
                {t('app.format.xml.sample')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed.stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <XmlMetric
            label={t('app.format.xml.metric.characters')}
            value={formatXmlNumber(parsed.stats.characters)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.lines')}
            value={formatXmlNumber(parsed.stats.lines)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.elements')}
            value={formatXmlNumber(parsed.stats.elements)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.attributes')}
            value={formatXmlNumber(parsed.stats.attributes)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.depth')}
            value={formatXmlNumber(parsed.stats.depth)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.comments')}
            value={formatXmlNumber(parsed.stats.comments)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.cdata')}
            value={formatXmlNumber(parsed.stats.cdata)}
          />
          <XmlMetric
            label={t('app.format.xml.metric.pi')}
            value={formatXmlNumber(parsed.stats.processingInstructions)}
          />
        </div>
      )}

      {isInputTooLarge && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
          <XCircle className="h-4 w-4" />
          {t('app.format.xml.warning.too_large', {
            limit: formatXmlNumber(MAX_XML_INPUT_CHARS)
          })}
        </p>
      )}

      {validationError && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
          <XCircle className="h-4 w-4" />
          {t('app.format.xml.invalid')}: {validationError}
        </p>
      )}

      {!validationError && parsed.stats && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--success)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
          {t('app.format.xml.valid')}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.xml.input')}</CardTitle>
            <CardDescription>
              {hasInput
                ? t('app.format.xml.input_hint', { count: input.length })
                : t('app.format.xml.empty')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.xml.placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.xml.output')}</CardTitle>
            <CardDescription>
              {formatted.output
                ? t('app.format.xml.output_valid')
                : t('app.format.xml.output_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={formatted.output}
              readOnly
              placeholder={t('app.format.xml.output_placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.xml.tags')}
            </CardTitle>
            <CardDescription>{t('app.format.xml.tags_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.tags.length ? (
              <div className="flex flex-wrap gap-2">
                {parsed.tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => void copy(tag)}
                    className="rounded-full bg-[var(--primary-subtle)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--primary)]"
                  >
                    {tag} x{count}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {t('app.format.xml.tags_empty')}
              </p>
            )}

            {parsed.attributes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--text-tertiary)]">
                  {t('app.format.xml.attributes')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {parsed.attributes.map(([attribute, count]) => (
                    <button
                      key={attribute}
                      type="button"
                      onClick={() => void copy(attribute)}
                      className="rounded-full bg-[var(--glass-input-bg)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--text-primary)]"
                    >
                      {attribute} x{count}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.xml.outline')}
            </CardTitle>
            <CardDescription>
              {t('app.format.xml.outline_hint', { limit: formatXmlNumber(MAX_XML_NODE_ROWS) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parsed.nodes.length ? (
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {parsed.nodes.map(node => (
                  <button
                    key={node.path}
                    type="button"
                    onClick={() => void copy(node.path)}
                    className="grid w-full min-w-0 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2 text-left md:grid-cols-[minmax(0,0.45fr)_72px_minmax(0,0.55fr)] md:items-center"
                  >
                    <span className="truncate font-mono text-xs text-[var(--text-primary)]">
                      {node.name}
                    </span>
                    <span className="w-fit rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                      d{node.depth}
                    </span>
                    <span className="truncate font-mono text-xs text-[var(--text-tertiary)]">
                      {node.path}
                      {node.attributes
                        ? ` · ${node.attributes} ${t('app.format.xml.attr_short')}`
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4 text-sm text-[var(--text-secondary)]">
                {t('app.format.xml.outline_empty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const XmlMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default XmlClient
