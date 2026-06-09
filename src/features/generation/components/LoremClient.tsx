'use client'

import { LoremIpsum } from 'lorem-ipsum'
import { Copy, Download, FileJson, FileText, RotateCcw, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type LoremOutputFormat = 'html' | 'json' | 'list' | 'markdown' | 'plain'
type LoremUnit = 'paragraphs' | 'sentences' | 'words'

interface LoremFormData {
  count: number
  outputFormat: LoremOutputFormat
  startWithLorem: boolean
  unit: LoremUnit
}

interface LoremPreset {
  count: number
  labelKey: string
  outputFormat: LoremOutputFormat
  unit: LoremUnit
}

const lorem = new LoremIpsum({
  sentencesPerParagraph: { max: 8, min: 4 },
  wordsPerSentence: { max: 16, min: 4 }
})

const DEFAULT_FORM: LoremFormData = {
  count: 3,
  outputFormat: 'plain',
  startWithLorem: true,
  unit: 'paragraphs'
}

const UNIT_MAX: Record<LoremUnit, number> = {
  paragraphs: 30,
  sentences: 120,
  words: 600
}

const PRESETS: LoremPreset[] = [
  {
    count: 3,
    labelKey: 'app.generation.lorem.preset.article',
    outputFormat: 'markdown',
    unit: 'paragraphs'
  },
  {
    count: 8,
    labelKey: 'app.generation.lorem.preset.microcopy',
    outputFormat: 'plain',
    unit: 'sentences'
  },
  {
    count: 24,
    labelKey: 'app.generation.lorem.preset.tags',
    outputFormat: 'list',
    unit: 'words'
  },
  {
    count: 5,
    labelKey: 'app.generation.lorem.preset.fixture',
    outputFormat: 'json',
    unit: 'paragraphs'
  }
]

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const clampCount = (count: number, unit: LoremUnit) => {
  if (!Number.isFinite(count)) return 1
  return Math.min(Math.max(Math.round(count), 1), UNIT_MAX[unit])
}

const getGeneratedText = (formData: LoremFormData) => {
  const count = clampCount(formData.count, formData.unit)
  let text = ''

  switch (formData.unit) {
    case 'paragraphs':
      text = lorem.generateParagraphs(count)
      break
    case 'sentences':
      text = lorem.generateSentences(count)
      break
    case 'words':
      text = lorem.generateWords(count)
      break
  }

  if (!formData.startWithLorem || text.toLowerCase().startsWith('lorem ipsum')) return text
  const rest = text.replace(/^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)?/u, '').trimStart()
  return rest ? `Lorem ipsum ${rest}` : 'Lorem ipsum'
}

const splitParagraphs = (text: string) =>
  text
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean)

const splitSentences = (text: string) =>
  text
    .match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g)
    ?.map(item => item.trim())
    .filter(Boolean) ?? []

const formatOutput = (text: string, format: LoremOutputFormat, sectionLabel: string) => {
  if (!text) return ''

  const paragraphs = splitParagraphs(text)
  const sentences = splitSentences(text)
  const words = text.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? []

  switch (format) {
    case 'html':
      return paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n')
    case 'json':
      return JSON.stringify(
        {
          paragraphs,
          sentences,
          words,
          meta: {
            characters: text.length,
            paragraphCount: paragraphs.length,
            sentenceCount: sentences.length,
            wordCount: words.length
          }
        },
        null,
        2
      )
    case 'list': {
      const items = words.length <= 80 ? words : sentences.length ? sentences : paragraphs
      return items.map(item => `- ${item}`).join('\n')
    }
    case 'markdown':
      return paragraphs
        .map((paragraph, index) => `## ${sectionLabel} ${index + 1}\n\n${paragraph}`)
        .join('\n\n')
    case 'plain':
      return text
  }
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const getDownloadMeta = (format: LoremOutputFormat) => {
  switch (format) {
    case 'html':
      return { filename: 'daily-tools-lorem.html', type: 'text/html;charset=utf-8' }
    case 'json':
      return { filename: 'daily-tools-lorem.json', type: 'application/json;charset=utf-8' }
    case 'markdown':
      return { filename: 'daily-tools-lorem.md', type: 'text/markdown;charset=utf-8' }
    default:
      return { filename: 'daily-tools-lorem.txt', type: 'text/plain;charset=utf-8' }
  }
}

const LoremClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [formData, setFormData] = useState<LoremFormData>(DEFAULT_FORM)
  const [rawText, setRawText] = useState('')

  const formattedOutput = useMemo(
    () => formatOutput(rawText, formData.outputFormat, t('app.generation.lorem.section')),
    [formData.outputFormat, rawText, t]
  )

  const stats = useMemo(() => {
    const words = rawText.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? []
    return {
      characters: rawText.length,
      paragraphs: splitParagraphs(rawText).length,
      readingMinutes: rawText ? Math.max(1, Math.ceil(words.length / 225)) : 0,
      words: words.length
    }
  }, [rawText])

  const handleGenerate = useCallback(() => {
    setRawText(getGeneratedText(formData))
  }, [formData])

  const updateUnit = (unit: LoremUnit) => {
    setFormData(prev => ({
      ...prev,
      count: clampCount(prev.count, unit),
      unit
    }))
  }

  const applyPreset = (preset: LoremPreset) => {
    const nextForm = {
      ...formData,
      count: preset.count,
      outputFormat: preset.outputFormat,
      unit: preset.unit
    }
    setFormData(nextForm)
    setRawText(getGeneratedText(nextForm))
  }

  const handleDownload = () => {
    const meta = getDownloadMeta(formData.outputFormat)
    downloadText(formattedOutput, meta.filename, meta.type)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.lorem')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.generation.lorem.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setFormData(DEFAULT_FORM)}
              >
                {t('public.reset')}
              </Button>
              <Button
                variant="primary"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={handleGenerate}
              >
                {t('public.generate')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PRESETS.map(preset => (
              <button
                key={preset.labelKey}
                type="button"
                onClick={() => applyPreset(preset)}
                className="glass-panel glass-clip rounded-xl px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition-all hover:-translate-y-0.5 hover:glass-panel-strong"
              >
                {t(preset.labelKey)}
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                  {preset.count} {t(`app.generation.lorem.${preset.unit}`)} ·{' '}
                  {t(`app.generation.lorem.format.${preset.outputFormat}`)}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Label htmlFor="lorem-count">{t('app.generation.lorem.count')}</Label>
                <Input
                  id="lorem-count"
                  type="number"
                  min={1}
                  max={UNIT_MAX[formData.unit]}
                  value={formData.count}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      count: clampCount(Number(event.target.value), prev.unit)
                    }))
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-3">
                <Label>{t('app.generation.lorem.unit')}</Label>
                <RadioGroup
                  value={formData.unit}
                  onValueChange={value => updateUnit(value as LoremUnit)}
                  className="flex flex-wrap gap-3"
                >
                  {(['paragraphs', 'sentences', 'words'] as const).map(unit => (
                    <label
                      key={unit}
                      className="glass-panel flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-2 transition-all hover:glass-panel-strong"
                    >
                      <RadioGroupItem value={unit} />
                      <span className="text-sm">{t(`app.generation.lorem.${unit}`)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="lorem-format">{t('app.generation.lorem.output_format')}</Label>
                <Select
                  id="lorem-format"
                  value={formData.outputFormat}
                  onChange={event =>
                    setFormData(prev => ({
                      ...prev,
                      outputFormat: event.target.value as LoremOutputFormat
                    }))
                  }
                >
                  {(['plain', 'markdown', 'html', 'list', 'json'] as const).map(format => (
                    <option key={format} value={format}>
                      {t(`app.generation.lorem.format.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Checkbox
                checked={formData.startWithLorem}
                onChange={event =>
                  setFormData(prev => ({
                    ...prev,
                    startWithLorem: (event.target as HTMLInputElement).checked
                  }))
                }
                label={t('app.generation.lorem.start_with_lorem')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.generation.lorem.stat.characters')} value={stats.characters} />
            <Metric label={t('app.generation.lorem.stat.words')} value={stats.words} />
            <Metric label={t('app.generation.lorem.stat.paragraphs')} value={stats.paragraphs} />
            <Metric
              label={t('app.generation.lorem.stat.reading')}
              value={`${stats.readingMinutes} ${t('app.format.text.minutes')}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[360px] flex-1 flex-col">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-[var(--primary)]" />
              {t('app.generation.lorem.output')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => copy(formattedOutput)}
                disabled={!formattedOutput}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={handleDownload}
                disabled={!formattedOutput}
              >
                {t('app.generation.lorem.download')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <Textarea
            value={formattedOutput}
            readOnly
            placeholder={t('app.generation.lorem.placeholder')}
            className="min-h-[280px] flex-1 resize-none font-mono text-sm"
          />
        </CardContent>
      </Card>
    </div>
  )
}

const numberFormatter = new Intl.NumberFormat()

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="glass-input rounded-xl p-4">
    <div className="text-xs font-medium text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 font-mono text-lg font-semibold text-[var(--text-primary)]">
      {typeof value === 'number' ? numberFormatter.format(value) : value}
    </div>
  </div>
)

export default LoremClient
